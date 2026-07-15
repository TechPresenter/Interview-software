import { Interview } from '../models/Interview.js';
import { Candidate } from '../models/Candidate.js';
import { Job } from '../models/Job.js';
import { Company } from '../models/Company.js';
import { Answer } from '../models/Answer.js';
import { Report } from '../models/Report.js';
import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import * as engine from './ai/interview.engine.js';
import { scoreAnswer } from './ai/scoring.engine.js';
import { generateReport } from './ai/report.engine.js';
import { getAiWeightage } from './settings.service.js';
import { contextFor } from './knowledgeBase.service.js';
import { logActivity } from './audit.service.js';
import { notify } from './notification.service.js';
import { safeSendTemplated } from './email.service.js';
import { emitToCompany, emitToInterview } from '../socket/emitters.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as proctor from './proctoring.service.js';
import { saveBuffer } from './file.service.js';
import { getGroup } from './settings.service.js';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

/**
 * Interview Room orchestration. Drives the AI engine loop:
 *   start (greet + Q1) → answer (score → next Q | follow-up) → complete (report).
 *
 * The candidate is identified solely by the unguessable interview accessToken
 * (no login), so these functions take a token and enforce status/expiry.
 */

/** Find an interview by its public token, enforcing validity. */
export async function loadByToken(token, { lean = false } = {}) {
  const q = Interview.findOne({ accessToken: token });
  const interview = lean ? await q.lean() : await q;
  if (!interview) throw ApiError.notFound('Interview not found');
  if (interview.status === 'cancelled') throw ApiError.forbidden('This interview was cancelled');
  if (interview.status === 'terminated') throw ApiError.forbidden('This interview was ended by the interviewer');
  if (interview.expiresAt && interview.expiresAt < new Date() && interview.status === 'scheduled') {
    throw ApiError.forbidden('This interview link has expired');
  }
  return interview;
}

/** Candidate-facing room view (never leaks scores/evaluations). */
export async function roomView(interview) {
  const [candidate, job, company] = await Promise.all([
    Candidate.findById(interview.candidate).select('name email').lean(),
    interview.job ? Job.findById(interview.job).select('title company').lean() : null,
    Company.findById(interview.company).select('aiInterviewer name').lean(),
  ]);
  const ai = company?.aiInterviewer || {};
  return {
    id: interview._id,
    status: interview.status,
    types: interview.types,
    config: interview.config,
    candidate: { name: candidate?.name },
    job: { title: job?.title || 'the role' },
    interviewer: {
      name: ai.name || 'Sense',
      avatarUrl: ai.avatarUrl || null,
      voice: ai.voice || 'female',
      intro: ai.intro || null,
    },
    phase: interview.engineState.phase,
    progress: progressOf(interview),
    pendingQuestion: interview.status === 'in_progress' ? interview.engineState.pendingQuestion : undefined,
    transcript: interview.transcript,
    skips: {
      allowed: interview.config.allowSkip,
      used: interview.engineState.skipsUsed || 0,
      max: interview.config.maxSkips,
      remaining: Math.max(0, (interview.config.maxSkips || 0) - (interview.engineState.skipsUsed || 0)),
    },
  };
}

function progressOf(interview) {
  const total = interview.config.questionCount || 8;
  return { current: Math.min(interview.engineState.currentIndex, total), total };
}

/** Begin the interview: greeting + first question. Idempotent-ish. */
export async function start(interview, { language } = {}) {
  // Honour the same lock setLanguage() enforces — otherwise the scheduled
  // language is bypassable simply by passing one at the door.
  if ((language === 'en' || language === 'hi') && interview.config.allowLanguageChange) {
    interview.config.language = language;
  }
  if (interview.status === 'completed') throw ApiError.badRequest('Interview already completed');
  if (interview.status === 'in_progress' && interview.engineState.pendingQuestion?.text) {
    // Resume: return current state instead of regenerating.
    return {
      greeting: interview.transcript.find((t) => t.role === 'ai')?.text,
      question: interview.engineState.pendingQuestion,
      progress: progressOf(interview),
    };
  }

  const [candidate, job] = await Promise.all([
    Candidate.findById(interview.candidate).lean(),
    interview.job ? Job.findById(interview.job).lean() : null,
  ]);

  interview.status = 'in_progress';
  interview.startedAt = new Date();
  interview.engineState.phase = 'questioning';
  interview.engineState.currentIndex = 0;
  // Start at the difficulty the recruiter actually chose. Without this the
  // engineState default ('medium') silently won every interview.
  interview.engineState.difficulty = interview.config.difficulty || 'medium';

  let greeting = `Hi ${candidate?.name?.split(' ')[0] || 'there'}, welcome to your interview for ${job?.title || 'the role'}. I'll ask a few questions — answer naturally. Ready when you are.`;
  try {
    greeting = await engine.greet({ interview, candidate, job });
  } catch (err) {
    logger.warn({ err: err.message }, 'greeting fallback');
  }
  interview.transcript.push({ role: 'ai', text: greeting });

  const question = await generateQuestion(interview, job, null);
  interview.engineState.pendingQuestion = question;
  interview.transcript.push({ role: 'ai', text: question.text });
  await interview.save();

  emitToCompany(interview.company, 'interview:started', { id: interview._id });
  await logActivity({ company: interview.company, action: 'interview.started', entityType: 'Interview', entityId: interview._id, summary: `${candidate?.name} started their interview` });

  return { greeting, question, progress: progressOf(interview) };
}

/**
 * Record + score an answer, then return the next question or signal completion.
 * @param {object} interview mongoose doc
 * @param {{answer:string, durationSeconds?:number, audioUrl?:string}} payload
 */
export async function answer(interview, payload) {
  if (interview.status === 'paused') throw ApiError.badRequest('The interviewer paused this interview — please wait a moment.', { code: 'PAUSED' });
  if (interview.status !== 'in_progress') throw ApiError.badRequest('Interview is not in progress');
  const pending = interview.engineState.pendingQuestion;
  if (!pending?.text) throw ApiError.badRequest('No question is awaiting an answer');

  const job = interview.job ? await Job.findById(interview.job).lean() : null;

  // Score the answer (graceful fallback if AI unavailable).
  let evaluation = { score: null, competencyScores: {}, reasoning: 'Not scored', keywordsHit: [], keywordsMissed: [] };
  if (config.ai.enabled) {
    try {
      evaluation = await scoreAnswer({
        job,
        question: pending.text,
        competencies: pending.competencies,
        // The ideal-answer key for THIS question. Anchors the score and makes
        // keywordsMissed a real "missing concepts" signal rather than a guess.
        expectedPoints: pending.expectedPoints,
        answer: payload.answer,
        company: interview.company,
        interview: interview._id,
        language: interview.config.language, // feedback/reasoning in the interview language
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'scoring fallback');
    }
  }

  await Answer.create({
    interview: interview._id,
    questionText: pending.text,
    response: payload.answer || '',
    audioUrl: payload.audioUrl,
    durationSeconds: payload.durationSeconds,
    order: interview.engineState.currentIndex,
    evaluation: { ...evaluation, competencyScores: evaluation.competencyScores },
  });

  interview.transcript.push({ role: 'candidate', text: payload.answer || '' });
  interview.engineState.currentIndex += 1;
  interview.engineState.askedTexts.push(pending.text);
  // Respect the toggle — this used to adapt unconditionally, so turning
  // adaptive difficulty OFF had no effect.
  if (interview.config.adaptiveDifficulty) {
    interview.engineState.difficulty = engine.adaptDifficulty(interview.engineState.difficulty, evaluation.score);
  }

  // Real-time insight for the watching recruiter (the evaluation is in scope).
  emitToInterview(interview._id, 'interview:answer:received', {
    order: interview.engineState.currentIndex,
    score: evaluation.score,
    competencyScores: evaluation.competencyScores,
    keywordsMissed: evaluation.keywordsMissed,
  });

  // Done?
  if (engine.isComplete(interview)) {
    interview.engineState.phase = 'closing';
    interview.engineState.pendingQuestion = undefined;
    const closing = 'Thank you — that completes the interview. We are generating your evaluation now.';
    interview.transcript.push({ role: 'ai', text: closing });
    await interview.save();
    return { done: true, message: closing, progress: progressOf(interview) };
  }

  // Follow-up: dig into the answer we just scored when the evaluator flagged
  // one and the company enabled follow-ups. We reuse the scorer's suggestion
  // (already computed above) rather than spending a second AI call, and never
  // chain a follow-up off a follow-up.
  if (interview.config.followUps && evaluation.followUpSuggested && !pending.isFollowUp) {
    const followUp = {
      text: evaluation.followUpSuggested,
      competencies: pending.competencies,
      // Probe exactly what they missed; fall back to the parent question's key.
      expectedPoints: evaluation.keywordsMissed?.length ? evaluation.keywordsMissed : pending.expectedPoints,
      rationale: 'Follow-up on an incomplete or notable answer.',
      isFollowUp: true,
    };
    interview.engineState.phase = 'follow_up';
    interview.engineState.pendingQuestion = followUp;
    interview.transcript.push({ role: 'ai', text: followUp.text });
    await interview.save();
    return { done: false, question: followUp, progress: progressOf(interview) };
  }

  // Next question.
  interview.engineState.phase = 'questioning';
  const next = await generateQuestion(interview, job, payload.answer);
  interview.engineState.pendingQuestion = next;
  interview.transcript.push({ role: 'ai', text: next.text });
  await interview.save();

  return { done: false, question: next, progress: progressOf(interview) };
}

/**
 * Skip / "ask another" — the candidate declines the current question. Enforces
 * the company's skip limit, records the skip, and serves the next question.
 */
export async function skip(interview) {
  if (interview.status !== 'in_progress') throw ApiError.badRequest('Interview is not in progress');
  if (!interview.config.allowSkip) throw ApiError.forbidden('Skipping is disabled for this interview');
  const used = interview.engineState.skipsUsed || 0;
  if (used >= interview.config.maxSkips) {
    throw ApiError.forbidden('No skips remaining', { code: 'NO_SKIPS_LEFT' });
  }
  const pending = interview.engineState.pendingQuestion;
  if (!pending?.text) throw ApiError.badRequest('No question to skip');

  const job = interview.job ? await Job.findById(interview.job).lean() : null;

  // Record the skip as a zero-scored answer for the report trail.
  await Answer.create({
    interview: interview._id,
    questionText: pending.text,
    response: '(skipped)',
    order: interview.engineState.currentIndex,
    evaluation: { score: 0, competencyScores: {}, reasoning: 'Candidate skipped this question.' },
  });

  interview.transcript.push({ role: 'candidate', text: '(skipped)' });
  interview.engineState.currentIndex += 1;
  interview.engineState.skipsUsed = used + 1;
  interview.engineState.askedTexts.push(pending.text);

  if (engine.isComplete(interview)) {
    interview.engineState.phase = 'closing';
    interview.engineState.pendingQuestion = undefined;
    const closing = 'Thank you — that completes the interview. We are generating your evaluation now.';
    interview.transcript.push({ role: 'ai', text: closing });
    await interview.save();
    return { done: true, message: closing, progress: progressOf(interview) };
  }

  const next = await generateQuestion(interview, job, null);
  interview.engineState.pendingQuestion = next;
  interview.transcript.push({ role: 'ai', text: next.text });
  await interview.save();
  return {
    done: false,
    question: next,
    progress: progressOf(interview),
    skipsRemaining: Math.max(0, interview.config.maxSkips - interview.engineState.skipsUsed),
  };
}

/**
 * Switch the interview language mid-session. Locked by default: the scheduled
 * language is enforced end-to-end unless the company explicitly enabled
 * `allowLanguageChange` at creation. When a change IS allowed, subsequent AI
 * questions/prompts and evaluations automatically use the new language (the
 * engine + scoring/report read interview.config.language), scoring stays
 * competency-based (language-agnostic), and the switch is logged to the audit
 * history + interview transcript.
 */
export async function setLanguage(interview, language) {
  if (language !== 'en' && language !== 'hi') throw ApiError.badRequest('Unsupported language');
  const from = interview.config.language;
  if (language === from) return { language, changed: false };

  if (!interview.config.allowLanguageChange) {
    throw ApiError.forbidden('The interview language is locked and cannot be changed during the session.', { code: 'LANGUAGE_LOCKED' });
  }

  interview.config.language = language;
  const label = (l) => (l === 'hi' ? 'Hindi' : 'English');
  interview.transcript.push({ role: 'system', text: `Interview language changed: ${label(from)} → ${label(language)} (question ${interview.engineState.currentIndex + 1}).`, at: new Date() });
  await interview.save();

  await logActivity({
    company: interview.company,
    action: 'interview.language.changed',
    entityType: 'Interview',
    entityId: interview._id,
    summary: `Language changed ${from} → ${language} at Q${interview.engineState.currentIndex + 1}`,
    meta: { from, to: language, atQuestion: interview.engineState.currentIndex + 1 },
  });

  return { language, changed: true };
}

/** Finalize: status, integrity, and generate the AI report. */
export async function complete(interview) {
  if (interview.status === 'completed') {
    const existing = await Report.findOne({ interview: interview._id }).lean();
    return { status: 'completed', reportId: existing?._id };
  }

  interview.status = 'completed';
  interview.completedAt = new Date();
  interview.engineState.phase = 'done';
  interview.recomputeIntegrity();
  await interview.save();

  const [answers, job, candidate] = await Promise.all([
    Answer.find({ interview: interview._id }).sort('order').lean(),
    interview.job ? Job.findById(interview.job).lean() : null,
    Candidate.findById(interview.candidate),
  ]);

  let report = null;
  if (config.ai.enabled) {
    try {
      const weightage = await getAiWeightage();
      const transcriptText = interview.transcript.map((t) => `${t.role.toUpperCase()}: ${t.text}`).join('\n');
      const generated = await generateReport({
        job,
        transcript: transcriptText,
        evaluations: answers.map((a) => a.evaluation || {}),
        integrityScore: interview.proctoring.integrityScore,
        weightage,
        company: interview.company,
        interview: interview._id,
        language: interview.config.language, // report narrative in the interview language
      });
      report = await Report.create({
        company: interview.company,
        interview: interview._id,
        candidate: interview.candidate,
        job: interview.job,
        model: config.ai.model,
        ...generated,
      });
      interview.report = report._id;
      await interview.save();
    } catch (err) {
      logger.error({ err: err.message }, 'report generation failed');
    }
  }

  // Notify the recruiter who set it up + bump candidate stage.
  if (candidate && candidate.stage === 'interview') {
    candidate.stage = 'shortlisted';
    await candidate.save();
  }
  // Thank-you email to the candidate (best-effort; scores stay internal).
  if (candidate?.email) {
    await safeSendTemplated('interview_completed', {
      to: candidate.email,
      vars: { name: candidate.name, jobTitle: job?.title || 'the role', link: config.clientUrl },
      company: interview.company,
      relatedUser: candidate.user,
    });
  }

  emitToCompany(interview.company, 'interview:completed', { id: interview._id, reportId: report?._id });
  if (interview.invitedBy) {
    await notify({
      recipient: interview.invitedBy,
      company: interview.company,
      type: 'report_ready',
      title: 'Interview report ready',
      body: `${candidate?.name || 'A candidate'} completed their interview.`,
      link: report ? `/dashboard/reports/${report._id}` : '/dashboard/interviews',
    });
  }
  await logActivity({ company: interview.company, action: 'interview.completed', entityType: 'Interview', entityId: interview._id, summary: `${candidate?.name} completed their interview` });

  return { status: 'completed', reportId: report?._id };
}

/** Append a proctoring event and recompute the integrity score. */
/** Read proctoring thresholds from admin settings (with sane defaults). */
async function proctoringThresholds() {
  try {
    const rows = await getGroup('proctoring', { unmask: true });
    const map = Object.fromEntries((rows || []).map((r) => [r.key.replace('proctoring.', ''), r.value]));
    return {
      flagAt: Number(map.flagScore) || 60,
      terminateAt: Number(map.autoTerminateScore) || 100,
    };
  } catch {
    return { flagAt: 60, terminateAt: 100 };
  }
}

/**
 * Record proctoring event(s). Accepts either a single legacy event
 * ({ type, severity, detail }) or a batch ({ events: [...] }). Delegates scoring
 * to proctoring.service (fraud score + risk level + flag/terminate thresholds).
 */
export async function recordProctoring(interview, body = {}) {
  const events = Array.isArray(body.events) ? body.events : body.type ? [body] : [];
  if (!events.length) return { fraudScore: interview.proctoring.fraudScore || 0 };
  const thresholds = await proctoringThresholds();
  return proctor.recordEvents(interview, events, thresholds);
}

/** Persist the device + network fingerprint (§10). */
export async function recordDevice(interview, body = {}) {
  return proctor.setDeviceNetwork(interview, body);
}

/**
 * Append one MediaRecorder chunk to the interview's recording file. The client
 * streams chunks throughout the interview (small, never rejected by a size cap),
 * so the FULL 1080p recording is captured incrementally and survives disconnects.
 * The first chunk (with the WebM header) creates the file + sets videoUrl; the
 * rest are appended in order to reconstruct a single playable file.
 */
export async function appendRecordingChunk(interview, buffer, { first = false, ext = 'webm' } = {}) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const existing = interview.recordings?.videoUrl;
  let filename = existing ? existing.split('/').pop() : null;

  if (first || !filename) {
    filename = `rec-${interview._id}-${Date.now()}.${ext.replace(/[^a-z0-9]/gi, '') || 'webm'}`;
    interview.recordings = { ...(interview.recordings?.toObject?.() || {}), videoUrl: `/uploads/${filename}` };
    await interview.save();
    await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer); // (re)create on first chunk
  } else {
    await fs.appendFile(path.join(UPLOAD_DIR, filename), buffer);
  }
  return { url: interview.recordings.videoUrl };
}

/**
 * Save an evidence screenshot (base64 data-URL or raw base64) and attach it.
 * When `attachToEvent` is set, the just-recorded event also references the URL.
 */
export async function recordEvidence(interview, { imageBase64, type = 'screenshot', reason } = {}) {
  if (!imageBase64) throw ApiError.badRequest('imageBase64 required');
  const b64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const buffer = Buffer.from(b64, 'base64');
  if (buffer.length > 4 * 1024 * 1024) throw ApiError.badRequest('Evidence image too large');
  const { url } = await saveBuffer(buffer, `evidence-${Date.now()}.jpg`);
  await proctor.addEvidence(interview, { type, reason, url });
  emitToCompany(interview.company, 'interview:evidence', { id: interview._id, url, reason });
  return { url };
}

/* ── helpers ───────────────────────────────────────────── */

/** Generate the next question via the engine, with a safe fallback. */
async function generateQuestion(interview, job, lastAnswer) {
  if (config.ai.enabled) {
    try {
      // Ground questions in the assigned knowledge base (interview overrides job).
      let knowledge = null;
      const kbId = interview.knowledgeBase || job?.knowledgeBase;
      if (kbId) {
        const ctx = await contextFor(kbId, { query: lastAnswer || job?.title || '', maxChars: 6000 });
        knowledge = ctx?.text || null;
      }
      const data = await engine.nextQuestion({
        interview,
        job,
        askedQuestions: interview.engineState.askedTexts,
        lastAnswer,
        transcriptSummary: interview.transcript.slice(-4).map((t) => `${t.role}: ${t.text}`).join(' | '),
        knowledge,
      });
      if (data?.question) {
        return {
          text: data.question,
          competencies: data.competencies || ['technical', 'communication'],
          expectedPoints: Array.isArray(data.expectedPoints) ? data.expectedPoints : [],
          rationale: data.rationale || '',
          isFollowUp: false,
        };
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'question generation fallback');
    }
  }
  return { text: fallbackQuestion(interview), competencies: ['communication'], expectedPoints: [], isFollowUp: false };
}

const FALLBACKS = [
  'Tell me about yourself and why this role interests you.',
  'Describe a challenging problem you solved recently. What was your approach?',
  'How do you prioritize work when everything feels urgent?',
  'Tell me about a time you worked with a difficult teammate.',
  'What is a recent thing you learned, and how did you apply it?',
  'Walk me through a project you are proud of.',
  'How do you handle feedback on your work?',
  'Where do you want to grow over the next year?',
];
const fallbackQuestion = (interview) => FALLBACKS[interview.engineState.currentIndex % FALLBACKS.length];

export default { loadByToken, roomView, start, answer, skip, setLanguage, complete, recordProctoring, recordDevice, recordEvidence, appendRecordingChunk };
