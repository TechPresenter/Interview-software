import { Question } from '../models/Question.js';
import { logger } from '../config/logger.js';

/**
 * Picks questions out of the bank for a live interview.
 *
 * This is the layer that makes the Question bank actually matter: before it,
 * every question was invented by the LLM on the fly (or, when AI was down, came
 * from a hardcoded generic list). Selection is relevance-ranked rather than
 * random so a Node.js interview never opens with a question about tax filing.
 *
 * Scoring is done in JS over a bounded candidate set rather than in an
 * aggregation pipeline — the candidate pool per interview is small (hundreds at
 * most) and this keeps the ranking rules readable and unit-testable.
 */

/** A company sees its own questions plus the approved public global bank. */
export function scopeFilter(companyId) {
  return {
    $or: [
      { company: companyId ?? null },
      { company: null, isPublic: true },
    ],
  };
}

/** Base filter every selection shares: live, approved, not archived. */
function baseFilter(companyId) {
  return {
    ...scopeFilter(companyId),
    isActive: true,
    archivedAt: null,
    status: 'approved',
  };
}

const norm = (s) => String(s || '').toLowerCase().trim();
const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'expert'];

/** Cheap lexical similarity so we don't re-ask a near-duplicate of an asked question. */
function tokenSet(text) {
  return new Set(norm(text).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/**
 * TOPICAL relevance only — "is this question about what this job is about?".
 *
 * Deliberately kept apart from the quality/fit bonuses in `score()`. When the two
 * were summed into one number, unrelated bonuses (matching language, having an
 * answer key) could lift a completely off-topic question above the cutoff — a
 * welding role was offered a React question. Relevance must stand on its own.
 *
 * @returns {number} > 0 selectable, 0 neutral-but-unusable, -1 hard exclude
 */
function relevanceOf(q, { skillWeights, type, industry, jobRole }) {
  let rel = 0;
  let overlap = 0;

  // Skill overlap, weighted by the job's own skill importance. Strongest signal.
  for (const skill of q.skills || []) {
    const w = skillWeights.get(norm(skill));
    if (w) {
      overlap += 1;
      rel += 10 * w;
    }
  }

  const questionTagged = (q.skills || []).length > 0;
  const jobTagged = skillWeights.size > 0;
  const industryMatch = Boolean(industry && q.category && q.category === industry);
  const roleMatch = Boolean(jobRole && q.jobRole && norm(q.jobRole) === norm(jobRole));

  if (industryMatch) rel += 5;
  if (roleMatch) rel += 5;

  // Hard exclude: the question is tagged for skills this job never asked for, and
  // nothing else ties it to the role. This is what keeps a tax question out of a
  // React interview.
  if (questionTagged && jobTagged && overlap === 0 && !industryMatch && !roleMatch) return -1;

  // An untagged question is generic by nature (e.g. "describe a project you're
  // proud of") and stays usable when the interview type matches.
  if (!questionTagged && type && q.type === type) rel += 2;

  return rel;
}

/** Quality/fit bonuses. Only ever applied to questions that already passed relevance. */
function score(q, ctx) {
  let s = 0;

  // Exact difficulty is best; adjacent rungs are usable; far rungs are penalised.
  const want = DIFFICULTY_ORDER.indexOf(ctx.difficulty);
  const have = DIFFICULTY_ORDER.indexOf(q.difficulty);
  if (want >= 0 && have >= 0) s += [8, 3, -4, -10][Math.abs(want - have)] ?? -10;

  if (ctx.type && q.type === ctx.type) s += 6;
  if (ctx.experienceLevel && q.experienceLevel === ctx.experienceLevel) s += 3;
  if (ctx.language && q.language === ctx.language) s += 4;
  else if (q.language === 'bilingual') s += 2;

  // Spread usage across the bank so the same few questions aren't always picked.
  s -= Math.min(4, (q.usageCount || 0) * 0.15);

  // A question with a real answer key scores better because it *scores* better.
  if (q.expectedPoints?.length || q.answerKey?.keyPoints?.length) s += 4;

  return s;
}

/**
 * Select the single best next question from the bank.
 *
 * @param {object} opts
 * @param {string|null} opts.companyId
 * @param {string[]} [opts.excludeIds]   already-asked question ids
 * @param {string[]} [opts.excludeTexts] already-asked question texts (near-dupe guard)
 * @param {Array<{name:string,weight?:number}>|string[]} [opts.skills]
 * @param {string} [opts.difficulty]
 * @param {string} [opts.type]
 * @param {string} [opts.industry]
 * @param {string} [opts.jobRole]
 * @param {string} [opts.experienceLevel]
 * @param {string} [opts.language]
 * @param {boolean} [opts.randomOrder] pick randomly among the strong matches
 * @returns {Promise<object|null>} the Question doc (lean) or null when the bank has nothing suitable
 */
export async function selectNextQuestion(opts = {}) {
  const {
    companyId = null,
    excludeIds = [],
    excludeTexts = [],
    skills = [],
    difficulty = 'medium',
    type,
    industry,
    jobRole,
    experienceLevel,
    language = 'en',
    randomOrder = false,
  } = opts;

  const skillNames = (skills || [])
    .map((s) => (typeof s === 'string' ? { name: s, weight: 1 } : s))
    .filter((s) => s?.name);
  const skillWeights = new Map(skillNames.map((s) => [norm(s.name), Math.max(0.1, s.weight ?? 1)]));

  const filter = { ...baseFilter(companyId) };
  if (excludeIds.length) filter._id = { $nin: excludeIds };
  // Only language-filter when the question is language-specific; bilingual always qualifies.
  if (language) filter.$and = [{ $or: [{ language }, { language: 'bilingual' }] }];

  // Prefer questions that touch at least one of the job's skills, but fall back
  // to the wider pool when the bank has no skill-tagged match.
  let candidates = [];
  if (skillWeights.size) {
    candidates = await Question.find({ ...filter, skills: { $in: [...skillWeights.keys()] } })
      .limit(300)
      .lean();
  }
  if (candidates.length < 5) {
    const wider = await Question.find(filter).limit(300).lean();
    const seen = new Set(candidates.map((c) => String(c._id)));
    candidates.push(...wider.filter((w) => !seen.has(String(w._id))));
  }
  if (!candidates.length) return null;

  // Drop near-duplicates of anything already asked this session.
  const askedTokens = (excludeTexts || []).map(tokenSet);
  const fresh = candidates.filter((q) => {
    const t = tokenSet(q.text);
    return !askedTokens.some((a) => jaccard(a, t) > 0.6);
  });
  if (!fresh.length) return null;

  const ctx = { skillWeights, difficulty, type, industry, jobRole, experienceLevel, language };

  // Relevance gate FIRST. Anything not topically tied to this role is dropped
  // outright — no amount of quality bonus can buy its way back in.
  const relevant = [];
  for (const q of fresh) {
    const rel = relevanceOf(q, ctx);
    if (rel > 0) relevant.push({ q, rel, s: rel + score(q, ctx) });
  }

  // The bank has nothing on-topic. Return null so the caller asks the LLM rather
  // than forcing an unrelated question on the candidate.
  if (!relevant.length) return null;

  relevant.sort((a, b) => b.s - a.s);
  const best = relevant[0];

  if (randomOrder) {
    // Random *among the good ones* — never random across the whole bank.
    const pool = relevant.filter((r) => r.s >= best.s * 0.7).slice(0, 8);
    return pool[Math.floor(Math.random() * pool.length)].q;
  }
  return best.q;
}

/** Bulk variant — pre-builds a question set (used by QuestionSet/templates). */
export async function selectQuestionSet(opts = {}, count = 8) {
  const picked = [];
  const excludeIds = [...(opts.excludeIds || [])];
  const excludeTexts = [...(opts.excludeTexts || [])];
  for (let i = 0; i < count; i += 1) {
    // Sequential by design: each pick depends on the previous exclusions.
    const q = await selectNextQuestion({ ...opts, excludeIds, excludeTexts });
    if (!q) break;
    picked.push(q);
    excludeIds.push(q._id);
    excludeTexts.push(q.text);
  }
  return picked;
}

/** Fire-and-forget usage accounting; never blocks the interview. */
export function markUsed(questionId) {
  if (!questionId) return;
  Question.updateOne({ _id: questionId }, { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } })
    .catch((err) => logger.warn({ err: err.message }, 'failed to record question usage'));
}

export default { selectNextQuestion, selectQuestionSet, markUsed, scopeFilter };
