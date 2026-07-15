import { completeJson } from './claude.client.js';
import { prompts, applyPromptOverride } from './prompts/index.js';
import { logger } from '../../config/logger.js';
import { Question } from '../../models/Question.js';
import { scopeFilter } from '../question.selector.js';
import {
  QUESTION_TYPES,
  DIFFICULTY,
  COMPETENCIES,
} from '../../constants/enums.js';

/**
 * AI question generation for the bank.
 *
 * The prompt states the relevance/no-duplicate rules, but a prompt is a request,
 * not a guarantee — so everything the model returns is re-checked here before it
 * can reach the bank. The product promise ("never irrelevant, random or
 * duplicated") has to hold even when the model has an off day.
 */

const norm = (s) => String(s || '').toLowerCase().trim();

function tokenSet(text) {
  return new Set(norm(text).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/** Questions this vague are filler regardless of what the model claims. */
const FILLER = [
  /^tell me about yourself/i,
  /^why (do you want to work|should we hire)/i,
  /^what are your (strengths|weaknesses)/i,
  /^where do you see yourself/i,
];

/** Never-ask topics. Cheap backstop behind the prompt's fairness rule. */
const DISCRIMINATORY = /\b(caste|religion|marital status|married|pregnan|children|kids|age|how old|gender|sexual|politic|nationality|disabilit|health condition)\b/i;

/**
 * Validate + normalise one generated question. Returns null when it must be dropped.
 * @returns {object|null}
 */
function sanitize(raw, ctx) {
  const text = String(raw?.text || '').trim();
  if (text.length < 12) return null;

  // The model must justify relevance against a named input; no justification
  // means it could not tie the question to the role.
  if (ctx.requireRelevance && !String(raw?.relevance || '').trim()) {
    logger.debug({ text }, 'dropped generated question: no relevance justification');
    return null;
  }
  if (FILLER.some((re) => re.test(text))) {
    logger.debug({ text }, 'dropped generated question: generic filler');
    return null;
  }
  if (DISCRIMINATORY.test(text)) {
    logger.warn({ text }, 'dropped generated question: potentially discriminatory');
    return null;
  }

  const type = QUESTION_TYPES.includes(raw?.type) ? raw.type : ctx.defaultType || 'technical';
  const difficulty = DIFFICULTY.includes(raw?.difficulty) ? raw.difficulty : ctx.difficulty || 'medium';
  const competencies = (Array.isArray(raw?.competencies) ? raw.competencies : [])
    .filter((c) => COMPETENCIES.includes(c));

  const q = {
    text,
    type,
    difficulty,
    topic: raw?.topic ? String(raw.topic).slice(0, 120) : undefined,
    category: ctx.industry || null,
    jobRole: ctx.jobTitle,
    department: ctx.department,
    experienceLevel: ctx.experienceLevel || null,
    language: ctx.language || 'en',
    // Fall back to the job's own skills so a question is never left untagged —
    // untagged questions are invisible to the selector's skill ranking.
    skills: (Array.isArray(raw?.skills) && raw.skills.length ? raw.skills : ctx.skills || []).map((s) => norm(typeof s === 'string' ? s : s?.name)).filter(Boolean),
    competencies: competencies.length ? competencies : ['technical', 'communication'],
    expectedPoints: (Array.isArray(raw?.expectedPoints) ? raw.expectedPoints : []).map(String).filter(Boolean),
    rationale: raw?.relevance ? String(raw.relevance) : undefined,
  };

  if (['mcq', 'true_false'].includes(type)) {
    const options = (Array.isArray(raw?.options) ? raw.options : [])
      .map((o) => ({ text: String(o?.text || '').trim(), isCorrect: Boolean(o?.isCorrect) }))
      .filter((o) => o.text);
    // An MCQ with no correct option can never be scored.
    if (options.length < 2 || !options.some((o) => o.isCorrect)) {
      logger.debug({ text }, 'dropped generated MCQ: missing options or correct answer');
      return null;
    }
    q.mcq = { options, multiSelect: options.filter((o) => o.isCorrect).length > 1 };
  }

  if (raw?.textHi) q.textHi = String(raw.textHi);
  return q;
}

/**
 * Generate questions for a job spec.
 *
 * @param {object} input the 14 generation inputs (see prompts.generateQuestions)
 * @param {object} [opts]
 * @param {string|null} [opts.companyId] scope for the duplicate check
 * @returns {Promise<{questions: object[], dropped: number, reasons: object}>}
 */
export async function generateQuestions(input, opts = {}) {
  const count = Math.min(Math.max(Number(input.count) || 10, 1), 50);

  // Show the model what the bank already has so it doesn't restate it, and keep
  // the same list for our own duplicate check afterwards.
  const existing = await Question.find({
    ...scopeFilter(opts.companyId ?? null),
    archivedAt: null,
    ...(input.jobTitle ? { $or: [{ jobRole: input.jobTitle }, { skills: { $in: (input.skills || []).map(norm) } }] } : {}),
  })
    .select('text')
    .limit(200)
    .lean();
  const existingTexts = existing.map((e) => e.text);

  const built = await applyPromptOverride(
    'generateQuestions',
    prompts.generateQuestions({ ...input, count, existingQuestions: existingTexts }),
  );

  const { data } = await completeJson({
    ...built,
    feature: 'question_generation',
    company: opts.companyId,
    maxTokens: Math.min(16000, 700 * count + 1500),
  });

  const rawList = Array.isArray(data?.questions) ? data.questions : [];
  const ctx = {
    requireRelevance: true,
    defaultType: (input.types || [])[0],
    difficulty: input.difficulty,
    industry: input.industry,
    jobTitle: input.jobTitle,
    department: input.department,
    experienceLevel: input.experienceLevel,
    language: input.language,
    skills: input.skills,
  };

  const reasons = { filler: 0, duplicate: 0, invalid: 0 };
  const seen = existingTexts.map(tokenSet);
  const out = [];

  for (const raw of rawList) {
    const q = sanitize(raw, ctx);
    if (!q) {
      reasons.invalid += 1;
      continue;
    }
    // Dedupe against the bank AND against earlier picks in this same batch.
    const t = tokenSet(q.text);
    if (seen.some((s) => jaccard(s, t) > 0.55)) {
      reasons.duplicate += 1;
      continue;
    }
    seen.push(t);
    out.push(q);
  }

  logger.info(
    { requested: count, returned: rawList.length, kept: out.length, ...reasons },
    'AI question generation complete',
  );
  return { questions: out, dropped: rawList.length - out.length, reasons };
}

/** Build the full answer key for a single question. */
export async function generateAnswerKey({ question, jobTitle, skills, difficulty, competencies, language, companyId }) {
  const built = await applyPromptOverride(
    'generateAnswerKey',
    prompts.generateAnswerKey({ question, jobTitle, skills, difficulty, competencies, language }),
  );
  const { data } = await completeJson({ ...built, feature: 'answer_key', company: companyId, maxTokens: 2500 });
  if (!data) return null;

  const arr = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
  return {
    idealAnswer: data.idealAnswer ? String(data.idealAnswer) : '',
    keyPoints: arr(data.keyPoints),
    expectedSkills: arr(data.expectedSkills),
    strongIndicators: arr(data.strongIndicators),
    weakIndicators: arr(data.weakIndicators),
    followUps: arr(data.followUps),
    rubric: (Array.isArray(data.rubric) ? data.rubric : [])
      .filter((r) => r && typeof r.min === 'number' && typeof r.max === 'number')
      .map((r) => ({ band: String(r.band || ''), min: r.min, max: r.max, descriptor: String(r.descriptor || '') })),
    interviewerNotes: data.interviewerNotes ? String(data.interviewerNotes) : '',
    generatedAt: new Date(),
  };
}

export default { generateQuestions, generateAnswerKey };
