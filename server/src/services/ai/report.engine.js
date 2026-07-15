import { completeJson } from './claude.client.js';
import { prompts, applyPromptOverride } from './prompts/index.js';
import { aggregate, defaultWeightage } from './scoring.engine.js';
import { RECOMMENDATIONS } from '../../constants/enums.js';

/**
 * AI Report Generator
 * -------------------
 * Combines deterministic aggregation (from the scoring engine) with an LLM pass
 * for qualitative narrative (strengths/weaknesses/feedback/recommendation).
 */

/**
 * @param {object} args
 * @param {object} args.job
 * @param {string} args.transcript flattened transcript text
 * @param {Array} args.evaluations per-answer evaluations
 * @param {number} [args.integrityScore]
 * @param {Record<string,number>} [args.weightage]
 * @param {string} args.company
 * @param {string} args.interview
 */
export async function generateReport({ job, transcript, evaluations, answers, integrityScore, weightage, company, interview, language }) {
  const weights = weightage || defaultWeightage();
  // Deterministic numeric baseline.
  const agg = aggregate(evaluations, weights);

  // Qualitative + recommendation via LLM.
  const built = await applyPromptOverride('finalReport', prompts.finalReport({
    jobTitle: job?.title || 'the role',
    transcript: (transcript || '').slice(0, 20000),
    perAnswer: evaluations.map((e) => ({
      score: e.score,
      competencyScores: e.competencyScores,
      reasoning: e.reasoning,
    })),
    weightage: weights,
    language,
  }));
  const { data } = await completeJson({
    ...built,
    feature: 'report',
    company,
    interview,
    maxTokens: 3000,
  });

  // Prefer deterministic aggregate scores where available; fall back to LLM.
  const scores = { ...(data.scores || {}) };
  for (const [k, v] of Object.entries(agg.scores)) if (v != null) scores[k] = v;
  const overallScore = agg.overallScore ?? clamp(data.overallScore);

  return {
    scores,
    overallScore,
    perQuestion: buildPerQuestion(answers),
    skillCoverage: buildSkillCoverage(job, answers),
    strengths: data.strengths || [],
    weaknesses: data.weaknesses || [],
    improvementAreas: data.improvementAreas || [],
    detailedFeedback: data.detailedFeedback || '',
    candidateSummary: data.candidateSummary || '',
    recommendation: RECOMMENDATIONS.includes(data.recommendation)
      ? data.recommendation
      : recommendationFromScore(overallScore),
    weightage: weights,
    integrityScore,
    language: language === 'hi' ? 'hi' : 'en',
  };
}

/**
 * Flatten each Answer into the report's per-question breakdown.
 *
 * Every field here was already being computed and persisted per answer; it was
 * simply never surfaced, so the report showed an aggregate score with nothing
 * behind it. This is a pure projection — no extra AI call.
 */
export function buildPerQuestion(answers = []) {
  return [...answers]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((a) => {
      const ev = a.evaluation || {};
      return {
        order: a.order,
        question: a.question,
        questionText: a.questionText,
        answerText: a.response,
        score: ev.score ?? null,
        competencies: a.competencies || [],
        expectedPoints: a.expectedPoints || [],
        covered: ev.keywordsHit || [],
        missed: ev.keywordsMissed || [],
        reasoning: ev.reasoning || '',
        isFollowUp: Boolean(a.isFollowUp),
        skipped: Boolean(a.skipped),
        durationSeconds: a.durationSeconds,
      };
    });
}

/**
 * How well each required skill was actually covered — answers the recruiter's
 * "did you even ask about X?" question, which an overall score cannot.
 */
export function buildSkillCoverage(job, answers = []) {
  const skills = (job?.skills || []).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean);
  if (!skills.length) return [];

  return skills.map((skill) => {
    const needle = String(skill).toLowerCase();
    const hits = answers.filter((a) => {
      const tagged = (a.competencies || []).some((c) => String(c).toLowerCase() === needle);
      return tagged || String(a.questionText || '').toLowerCase().includes(needle);
    });
    const scored = hits.map((h) => h.evaluation?.score).filter((s) => typeof s === 'number');
    return {
      skill,
      asked: hits.length,
      score: scored.length ? Math.round(scored.reduce((s, n) => s + n, 0) / scored.length) : null,
    };
  });
}

/** Fallback mapping if the model omits a valid recommendation. */
export function recommendationFromScore(score) {
  if (score >= 85) return 'strong_hire';
  if (score >= 70) return 'hire';
  if (score >= 50) return 'consider';
  return 'reject';
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export default { generateReport, recommendationFromScore };
