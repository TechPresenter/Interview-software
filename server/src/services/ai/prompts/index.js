/**
 * Versioned prompt templates. These are the defaults; the super-admin "AI
 * Management" panel can override any of them by storing a replacement in
 * SystemSetting (group: 'ai'). Keep each prompt a pure function of its inputs
 * so it stays testable and overrideable — then run the result through
 * `applyPromptOverride` at the call site to honour any stored override.
 */

import { getSetting } from '../../settings.service.js';

const langLine = (language) =>
  language === 'hi'
    ? '\nIMPORTANT: Speak to the candidate in natural, professional Hindi (Devanagari script). Keep technical terms in English where natural.'
    : '';

const personaSystem = (interviewType, language) => `You are "Sense", a professional, warm, and fair AI interviewer for the HireSense platform.
You are conducting a ${interviewType} interview. Be concise, encouraging, and human.
Never reveal scoring, never give the answer, and never make hiring promises.
Ask one question at a time. Keep questions clear and role-relevant.${langLine(language)}`;

export const prompts = {
  /** Opening greeting + process intro. */
  greeting: ({ candidateName, jobTitle, interviewType, durationMinutes, questionCount, language }) => ({
    system: personaSystem(interviewType, language),
    messages: [
      {
        role: 'user',
        content: `Greet ${candidateName} for the "${jobTitle}" ${interviewType} interview. Briefly explain: it lasts about ${durationMinutes} minutes, there are roughly ${questionCount} questions, answers are recorded, and they should answer naturally. End by asking if they're ready to begin. 2-4 sentences.${language === 'hi' ? ' Respond in Hindi.' : ''}`,
      },
    ],
  }),

  /** Generate the next question, adapting to difficulty and history. */
  nextQuestion: ({ jobTitle, skills, interviewType, difficulty, askedQuestions, lastAnswer, transcriptSummary, language, knowledge }) => ({
    system: personaSystem(interviewType, language),
    messages: [
      {
        role: 'user',
        content: `Role: ${jobTitle}\nKey skills: ${(skills || []).join(', ') || 'general'}\nDesired difficulty: ${difficulty}\nAlready asked: ${(askedQuestions || []).join(' | ') || 'none'}\nConversation so far: ${transcriptSummary || 'just started'}\n${lastAnswer ? `Candidate's last answer: "${lastAnswer}"` : ''}${knowledge ? `\n\nKNOWLEDGE BASE — you MUST base your question ONLY on the following material. Do not ask about anything outside it:\n"""${String(knowledge).slice(0, 6000)}"""` : ''}\n\nProduce the single best next ${interviewType} question${knowledge ? ', grounded strictly in the knowledge base above' : ''}. Do not repeat asked topics. It MUST be directly relevant to the role and skills above — never generic filler.

Also produce "expectedPoints": the 3-6 concrete points a strong answer must cover (the ideal-answer key). These anchor scoring, so make them specific and checkable, not vague.
${language === 'hi' ? 'The "question" text MUST be written in Hindi (Devanagari). Keep "expectedPoints" in English so they remain stable scoring anchors. ' : ''}Return JSON: {"question": string, "competencies": string[], "expectedPoints": string[], "rationale": string}`,
      },
    ],
  }),

  /** Decide whether to dig deeper into the last answer. */
  followUp: ({ question, answer, interviewType, language }) => ({
    system: personaSystem(interviewType, language),
    messages: [
      {
        role: 'user',
        content: `Question asked: "${question}"\nCandidate answer: "${answer}"\n\nIf the answer is vague, incomplete, or notably strong/weak and a follow-up would add signal, write a short follow-up question. Otherwise return null.${language === 'hi' ? ' Write the follow-up question in Hindi (Devanagari).' : ''} Return JSON: {"followUp": string|null}`,
      },
    ],
  }),

  /** Score a single answer across competencies. */
  scoreAnswer: ({ jobTitle, question, expectedPoints, answer, competencies, language }) => ({
    system: `You are a rigorous, unbiased technical interviewer evaluating a candidate answer for the role of ${jobTitle}. Score fairly; reward correctness, depth, structure, and communication. Penalize fabrication. Judge the answer on its substance regardless of the language it is written in.`,
    messages: [
      {
        role: 'user',
        content: `Question: "${question}"\nExpected points (guidance, may be empty): ${(expectedPoints || []).join('; ') || 'use your judgment'}\nCompetencies to assess: ${(competencies || ['technical', 'communication']).join(', ')}\nCandidate answer: "${answer || '(no answer)'}"\n\nReturn JSON:\n{"score": number 0-100, "competencyScores": { "<competency>": number 0-100 }, "keywordsHit": string[], "keywordsMissed": string[], "reasoning": string, "followUpSuggested": string|null }${language === 'hi' ? '\nWrite "reasoning" and "followUpSuggested" in Hindi (Devanagari). Keep JSON keys, competency names, and numbers as-is.' : ''}`,
      },
    ],
  }),

  /** Generate the final structured report. */
  finalReport: ({ jobTitle, transcript, perAnswer, weightage, language }) => ({
    system: `You are an expert hiring assessor. Produce a fair, evidence-based final evaluation for the role of ${jobTitle}. Base every claim on the transcript. Be specific and actionable.`,
    messages: [
      {
        role: 'user',
        content: `Scoring weightage: ${JSON.stringify(weightage)}\nPer-answer evaluations: ${JSON.stringify(perAnswer)}\nFull transcript: ${transcript}\n\nReturn JSON:\n{"scores": {"technical": n, "domain": n, "communication": n, "confidence": n, "behavioral": n, "leadership": n, "problemSolving": n, "culturalFit": n}, "overallScore": n, "strengths": string[], "weaknesses": string[], "improvementAreas": string[], "detailedFeedback": string, "candidateSummary": string, "recommendation": "strong_hire"|"hire"|"consider"|"reject"} (all scores 0-100)

"domain" is role/industry-specific knowledge, as distinct from general technical skill.
"candidateSummary" is shown TO THE CANDIDATE: 2-4 encouraging, constructive sentences on how they did and what to work on. It must never mention scores, the recommendation, or whether they are likely to be hired.${language === 'hi' ? '\nWrite ALL narrative text — strengths, weaknesses, improvementAreas, detailedFeedback, and candidateSummary — in Hindi (Devanagari). Keep the JSON keys, the numeric scores, and the "recommendation" enum value in English.' : ''}`,
      },
    ],
  }),

  /**
   * Bulk-generate questions INTO the bank from a job spec.
   *
   * The hard product requirement is that nothing irrelevant, random or duplicated
   * ever reaches a candidate, so the rules are stated as explicit constraints and
   * every question must carry a `relevance` justification tying it to a named
   * input. A question the model cannot justify is one it should not have written.
   */
  generateQuestions: ({
    jobTitle, jobDescription, department, industry, skills, resumeText, experienceLevel,
    yearsExperience, education, certifications, round, difficulty, count, durationMinutes,
    language, types, existingQuestions, knowledge,
  }) => ({
    system: `You are a senior ${industry || 'industry'} hiring expert who writes interview questions for the HireSense platform.
You write questions that a competent interviewer for THIS role would actually ask. You never pad a set with filler.

HARD RULES — a violation makes the whole set unusable:
1. RELEVANT: every question must be answerable-about and specific to the role, its skills, or the provided material. Never generic filler ("tell me about yourself"), never a question about an unrelated field.
2. NO DUPLICATES: no two questions may test the same thing, and none may restate a question in "Already in the bank" below — not even reworded.
3. CALIBRATED: match the requested difficulty and the candidate's experience level. Do not ask a fresher to design a distributed system; do not ask a principal engineer to reverse a string.
4. FAIR: nothing about age, gender, religion, marital status, caste, region, health, or politics.
5. GROUNDED: if reference material is supplied, base the questions on it and nothing else.
6. ANSWERABLE ALOUD: these are spoken interview questions${durationMinutes ? `, and the whole set must fit roughly ${durationMinutes} minutes` : ''}.

If you cannot write ${count} questions that satisfy every rule, return FEWER. A short, sharp set beats a padded one.${langLine(language)}`,
    messages: [
      {
        role: 'user',
        content: `Role: ${jobTitle || 'n/a'}
Department: ${department || 'n/a'}
Industry: ${industry || 'n/a'}
Interview round: ${round || 'general'}
Key skills: ${(skills || []).join(', ') || 'n/a'}
Experience level: ${experienceLevel || 'n/a'}${yearsExperience ? ` (~${yearsExperience} years)` : ''}
Education: ${education || 'n/a'}
Certifications: ${(certifications || []).join(', ') || 'n/a'}
Requested difficulty: ${difficulty || 'medium'}
Requested question types: ${(types || []).join(', ') || 'any suitable mix'}
${jobDescription ? `\nJob description:\n"""${String(jobDescription).slice(0, 6000)}"""` : ''}
${resumeText ? `\nCandidate resume — tailor some questions to this person's ACTUAL background:\n"""${String(resumeText).slice(0, 6000)}"""` : ''}
${knowledge ? `\nREFERENCE MATERIAL — base every question ONLY on this:\n"""${String(knowledge).slice(0, 6000)}"""` : ''}
${existingQuestions?.length ? `\nAlready in the bank — do NOT repeat or reword any of these:\n${existingQuestions.slice(0, 60).map((q) => `- ${q}`).join('\n')}` : ''}

Write up to ${count || 10} interview questions.
${language === 'hi' ? 'Write "text" in Hindi (Devanagari); keep technical terms in English where natural. Keep expectedPoints in English so they stay stable scoring anchors.' : ''}${language === 'bilingual' ? 'Write "text" in English and "textHi" in Hindi (Devanagari) — the same question in both languages.' : ''}

For each question return:
- "text": the question as asked
- "type": one of technical|hr|behavioral|situational|scenario|problem_solving|coding|mcq|aptitude|logical_reasoning|communication|domain|leadership|role_specific|true_false|short_answer|long_answer
- "difficulty": easy|medium|hard|expert
- "topic": the specific topic it probes
- "skills": the skills it tests (use the role's skill names above where they apply)
- "competencies": from technical|communication|confidence|behavioral|leadership|problemSolving|culturalFit|domain
- "expectedPoints": 3-6 concrete, checkable points a strong answer must cover
- "relevance": one sentence naming WHICH input above makes this question relevant to this role
${(types || []).some((t) => ['mcq', 'true_false'].includes(t)) ? '- "options": for mcq/true_false only — [{"text": string, "isCorrect": boolean}] with exactly one correct unless the question says otherwise\n' : ''}
Return JSON: {"questions": [{...}]}`,
      },
    ],
  }),

  /**
   * Build the full answer key for one question (spec item 5): ideal answer, key
   * points, strong/weak indicators, follow-ups, rubric and interviewer notes.
   */
  generateAnswerKey: ({ question, jobTitle, skills, difficulty, competencies, language }) => ({
    system: `You are a senior interviewer writing the answer key an interviewer will grade against for the role of ${jobTitle || 'this role'}.
Be concrete and checkable. The key must let a non-expert interviewer tell a strong answer from a weak one without knowing the field.${langLine(language)}`,
    messages: [
      {
        role: 'user',
        content: `Question: "${question}"
Role: ${jobTitle || 'n/a'}
Key skills: ${(skills || []).join(', ') || 'n/a'}
Difficulty: ${difficulty || 'medium'}
Competencies assessed: ${(competencies || []).join(', ') || 'n/a'}

Return JSON:
{"idealAnswer": string (what a strong answer says, 4-8 sentences),
 "keyPoints": string[] (3-6 concrete points a strong answer MUST cover),
 "expectedSkills": string[],
 "strongIndicators": string[] (what marks an excellent answer),
 "weakIndicators": string[] (red flags / common wrong turns),
 "followUps": string[] (2-3 probing follow-ups),
 "rubric": [{"band": "excellent"|"good"|"average"|"poor", "min": number, "max": number, "descriptor": string}] (bands covering 0-100 with no gaps),
 "interviewerNotes": string (what to listen for, 1-3 sentences)}${language === 'hi' ? '\nWrite "idealAnswer", "interviewerNotes" and the rubric descriptors in Hindi (Devanagari). Keep "keyPoints" in English as stable scoring anchors.' : ''}`,
      },
    ],
  }),

  /** Resume analysis against a job. */
  analyzeResume: ({ resumeText, jobTitle, requiredSkills }) => ({
    system: `You are an ATS + resume-parsing engine and technical recruiter. Analyze the resume objectively against the target role AND extract structured candidate data. Only extract fields that genuinely appear in the resume — never fabricate contact details, salary, or employers. Use "" or [] when a field is not present.`,
    messages: [
      {
        role: 'user',
        content: `Target role: ${jobTitle || 'general'}\nRequired skills: ${(requiredSkills || []).join(', ') || 'n/a'}\nResume text:\n"""${(resumeText || '').slice(0, 14000)}"""\n\nReturn ONLY JSON:\n{"extractedSkills": string[], "missingSkills": string[], "yearsExperience": number, "atsScore": number 0-100, "jobMatch": number 0-100, "summary": string, "strengths": string[], "redFlags": string[], "parsed": {"fullName": string, "email": string, "phone": string, "whatsapp": string, "address": string, "city": string, "state": string, "country": string, "nationality": string, "linkedin": string, "website": string, "currentCompany": string, "currentDesignation": string, "totalExperienceYears": number, "highestQualification": string, "languages": string[], "certifications": [{"name": string, "issuer": string, "year": string}], "education": [{"degree": string, "institution": string, "field": string, "startYear": number, "endYear": number}], "workExperience": [{"title": string, "company": string, "startDate": string, "endDate": string, "current": boolean, "description": string}], "projects": [{"name": string, "description": string, "url": string}]}}`,
      },
    ],
  }),
};

/**
 * Apply a stored super-admin prompt override to a built prompt.
 *
 * The AI Management panel writes `ai.prompt.<key>` = { system, template }. Until
 * this existed the panel saved happily and changed nothing at runtime, which
 * failed silently — worse than not offering the feature. Never throws: a
 * settings read must not be able to break question generation or scoring.
 *
 * @param {string} key one of the keys in `prompts`
 * @param {{system: string, messages: object[]}} built the default built prompt
 */
export async function applyPromptOverride(key, built) {
  try {
    const override = await getSetting(`ai.prompt.${key}`, null);
    if (override?.system) return { ...built, system: override.system };
  } catch {
    /* fall back to the default prompt */
  }
  return built;
}

export default prompts;
