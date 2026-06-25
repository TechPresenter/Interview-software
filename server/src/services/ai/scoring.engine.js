import { completeJson } from './claude.client.js';
import { prompts } from './prompts/index.js';
import { COMPETENCIES } from '../../constants/enums.js';

/**
 * AI Scoring Engine
 * -----------------
 * Scores a single answer, and aggregates many per-answer evaluations into
 * weighted competency scores for the final report.
 */

/** Score one answer. Returns the evaluation object stored on the Answer doc. */
export async function scoreAnswer({ job, question, expectedPoints, answer, competencies, company, interview }) {
  const { data } = await completeJson({
    ...prompts.scoreAnswer({
      jobTitle: job?.title || 'the role',
      question,
      expectedPoints,
      answer,
      competencies,
    }),
    feature: 'scoring',
    company,
    interview,
  });
  return {
    score: clamp(data.score),
    competencyScores: data.competencyScores || {},
    reasoning: data.reasoning,
    keywordsHit: data.keywordsHit || [],
    keywordsMissed: data.keywordsMissed || [],
    followUpSuggested: data.followUpSuggested || null,
  };
}

/**
 * Aggregate per-answer competency scores into a single 0–100 score per
 * competency, then apply weightage to compute an overall score.
 * @param {Array<{competencyScores: Record<string,number>}>} evaluations
 * @param {Record<string, number>} [weightage] e.g. { technical: 0.4, communication: 0.2, ... }
 */
export function aggregate(evaluations, weightage = defaultWeightage()) {
  const sums = {};
  const counts = {};
  for (const ev of evaluations) {
    const cs = ev.competencyScores || {};
    for (const key of COMPETENCIES) {
      const v = cs[key];
      if (typeof v === 'number') {
        sums[key] = (sums[key] || 0) + v;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
  }
  const scores = {};
  for (const key of COMPETENCIES) {
    scores[key] = counts[key] ? Math.round(sums[key] / counts[key]) : null;
  }

  // Weighted overall over the competencies that actually have data.
  let weightedSum = 0;
  let weightTotal = 0;
  for (const key of COMPETENCIES) {
    if (scores[key] != null) {
      const w = weightage[key] ?? 0;
      weightedSum += scores[key] * w;
      weightTotal += w;
    }
  }
  const overallScore = weightTotal ? Math.round(weightedSum / weightTotal) : null;
  return { scores, overallScore };
}

export function defaultWeightage() {
  return {
    technical: 0.3,
    problemSolving: 0.2,
    communication: 0.15,
    behavioral: 0.1,
    confidence: 0.1,
    leadership: 0.075,
    culturalFit: 0.075,
  };
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export default { scoreAnswer, aggregate, defaultWeightage };
