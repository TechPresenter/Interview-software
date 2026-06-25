import { complete, completeJson } from './claude.client.js';
import { prompts } from './prompts/index.js';

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
  const { text } = await complete({
    ...prompts.greeting({
      candidateName: candidate.name,
      jobTitle: job?.title || 'the role',
      interviewType: interview.types?.[0] || 'general',
      durationMinutes: interview.config.durationMinutes,
      questionCount: interview.config.questionCount,
      language: interview.config.language,
    }),
    feature: 'interview',
    company: interview.company,
    interview: interview._id,
    temperature: 0.8,
  });
  return text;
}

/** Generate the next adaptive question. */
export async function nextQuestion({ interview, job, askedQuestions, lastAnswer, transcriptSummary }) {
  const { data } = await completeJson({
    ...prompts.nextQuestion({
      jobTitle: job?.title,
      skills: (job?.skills || []).map((s) => s.name),
      interviewType: interview.types?.[0] || 'general',
      difficulty: interview.engineState.difficulty,
      askedQuestions,
      lastAnswer,
      transcriptSummary,
      language: interview.config.language,
    }),
    feature: 'interview',
    company: interview.company,
    interview: interview._id,
  });
  return data; // { question, competencies, rationale }
}

/** Decide on a follow-up question for the last answer (or null). */
export async function maybeFollowUp({ interview, question, answer }) {
  const { data } = await completeJson({
    ...prompts.followUp({ question, answer, interviewType: interview.types?.[0] || 'general' }),
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
