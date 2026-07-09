import { completeJson } from './claude.client.js';
import { prompts } from './prompts/index.js';
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
export async function generateReport({ job, transcript, evaluations, integrityScore, weightage, company, interview, language }) {
  const weights = weightage || defaultWeightage();
  // Deterministic numeric baseline.
  const agg = aggregate(evaluations, weights);

  // Qualitative + recommendation via LLM.
  const { data } = await completeJson({
    ...prompts.finalReport({
      jobTitle: job?.title || 'the role',
      transcript: (transcript || '').slice(0, 20000),
      perAnswer: evaluations.map((e) => ({
        score: e.score,
        competencyScores: e.competencyScores,
        reasoning: e.reasoning,
      })),
      weightage: weights,
      language,
    }),
    feature: 'report',
    company,
    interview,
    maxTokens: 2048,
  });

  // Prefer deterministic aggregate scores where available; fall back to LLM.
  const scores = { ...(data.scores || {}) };
  for (const [k, v] of Object.entries(agg.scores)) if (v != null) scores[k] = v;
  const overallScore = agg.overallScore ?? clamp(data.overallScore);

  return {
    scores,
    overallScore,
    strengths: data.strengths || [],
    weaknesses: data.weaknesses || [],
    improvementAreas: data.improvementAreas || [],
    detailedFeedback: data.detailedFeedback || '',
    recommendation: RECOMMENDATIONS.includes(data.recommendation)
      ? data.recommendation
      : recommendationFromScore(overallScore),
    weightage: weights,
    integrityScore,
  };
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
