import { completeJson } from './claude.client.js';
import { prompts, applyPromptOverride } from './prompts/index.js';

/**
 * Resume Analyzer
 * ---------------
 * Given extracted resume text (PDF/DOCX → text happens at upload time in the
 * Phase 3 file pipeline) and an optional target job, returns skills, gaps, ATS
 * score, and job-match percentage.
 *
 * @param {object} args
 * @param {string} args.resumeText
 * @param {string} [args.jobTitle]
 * @param {string[]} [args.requiredSkills]
 * @param {string} [args.company]
 */
export async function analyzeResume({ resumeText, jobTitle, requiredSkills, company }) {
  if (!resumeText || resumeText.trim().length < 30) {
    throw new Error('Resume text is too short to analyze');
  }
  // Was spread directly, so a saved 'analyzeResume' override never took effect.
  const built = await applyPromptOverride('analyzeResume', prompts.analyzeResume({ resumeText, jobTitle, requiredSkills }));
  const { data } = await completeJson({
    ...built,
    feature: 'resume',
    company,
    maxTokens: 3000,
  });
  return {
    extractedSkills: data.extractedSkills || [],
    missingSkills: data.missingSkills || [],
    yearsExperience: data.yearsExperience ?? null,
    atsScore: clamp(data.atsScore),
    jobMatch: clamp(data.jobMatch),
    summary: data.summary || '',
    strengths: data.strengths || [],
    redFlags: data.redFlags || [],
    parsed: data.parsed || {},
    analyzedAt: new Date(),
  };
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

const clean = (v) => (typeof v === 'string' ? v.trim() : v);
const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

/**
 * Map the AI-parsed resume block to Candidate fields. Only returns fields the AI
 * actually found — the frontend prefills these for the recruiter to review/edit
 * before saving. Skills merge extracted + parsed. Contact fields are never
 * fabricated (the prompt is instructed accordingly).
 */
export function parsedToCandidate(analysis = {}) {
  const p = analysis.parsed || {};
  const out = {};
  const set = (k, v) => { const c = clean(v); if (c !== undefined && c !== null && c !== '' && !(Array.isArray(c) && !c.length)) out[k] = c; };

  set('name', p.fullName);
  set('email', typeof p.email === 'string' ? p.email.toLowerCase() : undefined);
  set('phone', p.phone);
  set('whatsapp', p.whatsapp);
  set('address', p.address);
  set('city', p.city);
  set('state', p.state);
  set('country', p.country);
  set('nationality', p.nationality);
  set('linkedin', p.linkedin);
  set('website', p.website);
  set('currentCompany', p.currentCompany);
  set('currentDesignation', p.currentDesignation);
  set('highestQualification', p.highestQualification);
  if (typeof p.totalExperienceYears === 'number') out.totalExperienceYears = p.totalExperienceYears;
  set('languages', arr(p.languages));
  set('certifications', arr(p.certifications).map((c) => ({ name: clean(c.name), issuer: clean(c.issuer), year: clean(c.year != null ? String(c.year) : '') })));
  set('education', arr(p.education).map((e) => ({
    degree: clean(e.degree),
    institution: clean(e.institution),
    field: clean(e.field),
    startYear: Number(e.startYear) || undefined,
    endYear: Number(e.endYear) || undefined,
  })));
  set('projects', arr(p.projects).map((pr) => ({ name: clean(pr.name), description: clean(pr.description), url: clean(pr.url) })));
  // AI uses `workExperience`; the Candidate model field is `experience`.
  const exp = arr(p.workExperience).map((e) => ({ title: clean(e.title), company: clean(e.company), current: !!e.current, description: clean(e.description) }));
  if (exp.length) out.experience = exp;
  // Merge skills (job-match extracted + any explicitly parsed).
  const skills = Array.from(new Set([...(arr(analysis.extractedSkills)), ...arr(p.skills)].map((s) => String(s).trim()).filter(Boolean)));
  if (skills.length) out.skills = skills;
  return out;
}

export default { analyzeResume, parsedToCandidate };
