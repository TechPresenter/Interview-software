/**
 * Versioned prompt templates. These are the defaults; the super-admin "AI
 * Management" panel (Phase 2) can override any of them by storing a replacement
 * in SystemSetting (group: 'ai'). Keep each prompt a pure function of its inputs
 * so it stays testable and overrideable.
 */

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
        content: `Role: ${jobTitle}\nKey skills: ${(skills || []).join(', ') || 'general'}\nDesired difficulty: ${difficulty}\nAlready asked: ${(askedQuestions || []).join(' | ') || 'none'}\nConversation so far: ${transcriptSummary || 'just started'}\n${lastAnswer ? `Candidate's last answer: "${lastAnswer}"` : ''}${knowledge ? `\n\nKNOWLEDGE BASE — you MUST base your question ONLY on the following material. Do not ask about anything outside it:\n"""${String(knowledge).slice(0, 6000)}"""` : ''}\n\nProduce the single best next ${interviewType} question${knowledge ? ', grounded strictly in the knowledge base above' : ''}. Do not repeat asked topics. ${language === 'hi' ? 'The "question" text MUST be written in Hindi (Devanagari). ' : ''}Return JSON: {"question": string, "competencies": string[], "rationale": string}`,
      },
    ],
  }),

  /** Decide whether to dig deeper into the last answer. */
  followUp: ({ question, answer, interviewType }) => ({
    system: personaSystem(interviewType),
    messages: [
      {
        role: 'user',
        content: `Question asked: "${question}"\nCandidate answer: "${answer}"\n\nIf the answer is vague, incomplete, or notably strong/weak and a follow-up would add signal, write a short follow-up question. Otherwise return null. Return JSON: {"followUp": string|null}`,
      },
    ],
  }),

  /** Score a single answer across competencies. */
  scoreAnswer: ({ jobTitle, question, expectedPoints, answer, competencies }) => ({
    system: `You are a rigorous, unbiased technical interviewer evaluating a candidate answer for the role of ${jobTitle}. Score fairly; reward correctness, depth, structure, and communication. Penalize fabrication.`,
    messages: [
      {
        role: 'user',
        content: `Question: "${question}"\nExpected points (guidance, may be empty): ${(expectedPoints || []).join('; ') || 'use your judgment'}\nCompetencies to assess: ${(competencies || ['technical', 'communication']).join(', ')}\nCandidate answer: "${answer || '(no answer)'}"\n\nReturn JSON:\n{"score": number 0-100, "competencyScores": { "<competency>": number 0-100 }, "keywordsHit": string[], "keywordsMissed": string[], "reasoning": string, "followUpSuggested": string|null }`,
      },
    ],
  }),

  /** Generate the final structured report. */
  finalReport: ({ jobTitle, transcript, perAnswer, weightage }) => ({
    system: `You are an expert hiring assessor. Produce a fair, evidence-based final evaluation for the role of ${jobTitle}. Base every claim on the transcript. Be specific and actionable.`,
    messages: [
      {
        role: 'user',
        content: `Scoring weightage: ${JSON.stringify(weightage)}\nPer-answer evaluations: ${JSON.stringify(perAnswer)}\nFull transcript: ${transcript}\n\nReturn JSON:\n{"scores": {"technical": n, "communication": n, "confidence": n, "behavioral": n, "leadership": n, "problemSolving": n, "culturalFit": n}, "overallScore": n, "strengths": string[], "weaknesses": string[], "improvementAreas": string[], "detailedFeedback": string, "recommendation": "strong_hire"|"hire"|"consider"|"reject"} (all scores 0-100)`,
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

export default prompts;
