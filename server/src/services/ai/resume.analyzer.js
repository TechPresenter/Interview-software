import { completeJson } from './claude.client.js';
import { prompts } from './prompts/index.js';

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
  const { data } = await completeJson({
    ...prompts.analyzeResume({ resumeText, jobTitle, requiredSkills }),
    feature: 'resume',
    company,
    maxTokens: 1536,
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
    analyzedAt: new Date(),
  };
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export default { analyzeResume };
