import { complete, completeJson } from './claude.client.js';
import { prompts, applyPromptOverride } from './prompts/index.js';

/**
 * AI Interview Engine
 * -------------------
 * Stateless functions that operate on an Interview document (state is persisted
 * by the caller / controller). Together they implement the flow:
 *   greet → ask → (optional follow-up) → adapt difficulty → close.
 */

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'expert'];

/** Step difficulty up/down based on the last answer's score (0–100). */
export function adaptDifficulty(current, lastScore) {
  const i = DIFFICULTY_ORDER.indexOf(current);
  if (lastScore == null) return current;
  if (lastScore >= 80) return DIFFICULTY_ORDER[Math.min(i + 1, DIFFICULTY_ORDER.length - 1)];
  if (lastScore <= 40) return DIFFICULTY_ORDER[Math.max(i - 1, 0)];
  return current;
}

/** Produce the opening greeting message. */
export async function greet({ interview, candidate, job }) {
  const built = await applyPromptOverride('greeting', prompts.greeting({
    candidateName: candidate.name,
    jobTitle: job?.title || 'the role',
    interviewType: interviewTypeLabel(interview.types),
    durationMinutes: interview.config.durationMinutes,
    questionCount: interview.config.questionCount,
    language: interview.config.language,
  }));
  const { text } = await complete({
    ...built,
    feature: 'interview',
    company: interview.company,
    interview: interview._id,
    temperature: 0.8,
  });
  return text;
}

/**
 * Describe the interview type. `types` is an array (e.g. ['hr','technical']) but
 * only types[0] was ever used, silently discarding every type after the first —
 * a "technical + behavioral" interview ran as technical only.
 */
export const interviewTypeLabel = (types) => {
  const list = (types || []).filter(Boolean);
  if (!list.length) return 'general';
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
};

/** Generate the next adaptive question (optionally grounded in a knowledge base). */
export async function nextQuestion({ interview, job, candidate, askedQuestions, lastAnswer, transcriptSummary, knowledge, minutesRemaining }) {
  const cfg = interview.config || {};
  // The toggles finally mean something: only send the JD / resume when asked to.
  const resumeSummary = cfg.resumeBased
    ? [candidate?.resumeAnalysis?.summary, (candidate?.resumeAnalysis?.extractedSkills || []).join(', ')]
      .filter(Boolean)
      .join('\nSkills found on resume: ')
    : null;

  const built = await applyPromptOverride('nextQuestion', prompts.nextQuestion({
    jobTitle: job?.title,
    jobDescription: cfg.jdBased ? job?.description : null,
    department: job?.department,
    industry: job?.industry,
    // Full skill objects, so weight/required actually influence the question.
    skills: job?.skills || [],
    experienceLevel: cfg.experienceLevel,
    yearsExperience: job?.experience?.min,
    interviewType: interviewTypeLabel(interview.types),
    round: interview.round,
    difficulty: interview.engineState.difficulty,
    askedQuestions,
    lastAnswer,
    transcriptSummary,
    questionNumber: (interview.engineState.currentIndex || 0) + 1,
    questionCount: cfg.questionCount,
    minutesRemaining,
    resumeSummary: resumeSummary || null,
    language: cfg.language,
    knowledge,
  }));
  const { data } = await completeJson({
    ...built,
    feature: 'interview',
    company: interview.company,
    interview: interview._id,
  });
  return data; // { question, competencies, expectedPoints, rationale }
}

/** Decide on a follow-up question for the last answer (or null). */
export async function maybeFollowUp({ interview, question, answer }) {
  // This spread the built prompt directly, so a saved 'followUp' override was
  // stored and never read — the admin panel reported success and changed nothing.
  const built = await applyPromptOverride('followUp', prompts.followUp({
    question,
    answer,
    interviewType: interviewTypeLabel(interview.types),
    language: interview.config?.language,
  }));
  const { data } = await completeJson({
    ...built,
    feature: 'interview',
    company: interview.company,
    interview: interview._id,
  });
  return data?.followUp || null;
}

/** Whether the interview should end (question budget reached). */
export function isComplete(interview) {
  return interview.engineState.currentIndex >= interview.config.questionCount;
}

export default { greet, nextQuestion, maybeFollowUp, adaptDifficulty, isComplete };
