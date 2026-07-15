/**
 * The built-in prompt bodies — the source every engine falls back to and the
 * target "reset to default" restores. The text here is tuned and live-verified;
 * treat a change to it as a change to interview quality.
 *
 * SHAPE CONTRACT
 * --------------
 * Each prompt is two strings (`system`, `template`) carrying {{placeholders}},
 * plus a `vars(input)` function that flattens the engine's named arguments into
 * the placeholder bag. The split is the whole design:
 *
 *   - `system`/`template` are prose. They are what a super-admin may edit, and
 *     what a database row replaces. Nothing but text and placeholders.
 *   - `vars()` is code, and stays code. The prompts were JS template literals
 *     whose conditional blocks, truncation caps and skill formatting were tangled
 *     into the text, and none of that survives being flattened into a DB string.
 *
 * So the conditional behaviour is precomputed into single variables rather than
 * dropped: {{jobDescriptionBlock}} is either the whole labelled JD section or an
 * empty string. This matters beyond tidiness — the blocks carry their own
 * CONSTRAINTS ("you MUST base your question ONLY on the following material"), so
 * a template that hardcoded the constraint would demand a knowledge base that was
 * never supplied. The caps (4000-char JD, 3000-char resume summary, 6000-char
 * knowledge, 14000-char resume) are what stop a long input blowing the context
 * window, so they live in `vars()` where an admin cannot delete them.
 *
 * An admin edits wording and placeholder ORDER, never control flow. That is a
 * deliberate ceiling: no template language, no logic in the database.
 *
 * Adding a placeholder to a template is safe (an unknown one renders empty and is
 * reported by previewPrompt); removing one silently drops that context from the
 * model's input, which is exactly what the preview screen exists to show.
 */

/** Prompt keys — one per engine hook. Mirrored by the PromptTemplate model's enum. */
export const PROMPT_KEYS = [
  'greeting',
  'nextQuestion',
  'followUp',
  'scoreAnswer',
  'finalReport',
  'generateQuestions',
  'generateAnswerKey',
  'analyzeResume',
];

export const PROMPT_CATEGORIES = ['interview', 'scoring', 'report', 'generation', 'resume'];

/** Hindi instruction appended to the persona/system line. */
const langLine = (language) =>
  language === 'hi'
    ? '\nIMPORTANT: Speak to the candidate in natural, professional Hindi (Devanagari script). Keep technical terms in English where natural.'
    : '';

/**
 * Shared interviewer persona. Seeded as a separate row per key, so the greeting
 * persona can be retuned without touching the questioning persona.
 */
const PERSONA_SYSTEM = `You are "Sense", a professional, warm, and fair AI interviewer for the HireSense platform.
You are conducting a {{interviewType}} interview. Be concise, encouraging, and human.
Never reveal scoring, never give the answer, and never make hiring promises.
Ask one question at a time. Keep questions clear and role-relevant.{{languageLine}}`;

const PERSONA_VARS = [
  { name: 'interviewType', description: 'Interview type label, e.g. "technical and behavioral".' },
  { name: 'languageLine', description: 'Hindi speaking instruction; empty unless language is "hi".' },
];

export const DEFAULT_PROMPTS = {
  greeting: {
    key: 'greeting',
    name: 'Interview greeting',
    category: 'interview',
    description: 'Opening message: greets the candidate and explains how the interview will run.',
    system: PERSONA_SYSTEM,
    template: `Greet {{candidateName}} for the "{{jobTitle}}" {{interviewType}} interview. Briefly explain: it lasts about {{durationMinutes}} minutes, there are roughly {{questionCount}} questions, answers are recorded, and they should answer naturally. End by asking if they're ready to begin. 2-4 sentences.{{hindiLine}}`,
    variables: [
      ...PERSONA_VARS,
      { name: 'candidateName', description: "The candidate's name." },
      { name: 'jobTitle', description: 'Job title being interviewed for.' },
      { name: 'durationMinutes', description: 'Planned interview length in minutes.' },
      { name: 'questionCount', description: 'Approximate number of questions.' },
      { name: 'hindiLine', description: 'Reply-in-Hindi instruction; empty unless language is "hi".' },
    ],
    vars: ({ candidateName, jobTitle, interviewType, durationMinutes, questionCount, language }) => ({
      candidateName,
      jobTitle,
      interviewType,
      durationMinutes,
      questionCount,
      languageLine: langLine(language),
      hindiLine: language === 'hi' ? ' Respond in Hindi.' : '',
    }),
  },

  nextQuestion: {
    key: 'nextQuestion',
    name: 'Next question',
    category: 'interview',
    description: 'Picks the next adaptive question from role context, history and any grounding material.',
    system: PERSONA_SYSTEM,
    template: `Role: {{jobTitle}}{{departmentLine}}{{industryLine}}{{roundLine}}
Key skills{{skillsWeightNote}}: {{skills}}
{{experienceLine}}Desired difficulty: {{difficulty}}
{{progressLine}}Already asked: {{askedQuestions}}
Conversation so far: {{transcriptSummary}}
{{lastAnswerLine}}{{jobDescriptionBlock}}{{resumeBlock}}{{knowledgeBlock}}

Produce the single best next {{interviewType}} question{{knowledgeGroundingNote}}. Do not repeat asked topics. It MUST be directly relevant to the role and skills above — never generic filler.

Also produce "expectedPoints": the 3-6 concrete points a strong answer must cover (the ideal-answer key). These anchor scoring, so make them specific and checkable, not vague.
{{hindiNote}}Return JSON: {"question": string, "competencies": string[], "expectedPoints": string[], "rationale": string}`,
    variables: [
      ...PERSONA_VARS,
      { name: 'jobTitle', description: 'Job title, or "n/a".' },
      { name: 'departmentLine', description: 'Newline + "Department: X"; empty when unknown.' },
      { name: 'industryLine', description: 'Newline + "Industry: X"; empty when unknown.' },
      { name: 'roundLine', description: 'Newline + "Interview round: X"; empty when unknown.' },
      { name: 'skillsWeightNote', description: 'Explains skill weights; empty when no skill is weighted.' },
      { name: 'skills', description: 'Comma-separated skills with weight/nice-to-have markers, or "general".' },
      { name: 'experienceLine', description: 'Target experience line, trailing newline; empty when unknown.' },
      { name: 'difficulty', description: 'Requested difficulty for this question.' },
      { name: 'progressLine', description: 'Question N of M + minutes left + pacing instruction; empty when no question budget.' },
      { name: 'askedQuestions', description: 'Pipe-separated questions already asked, or "none".' },
      { name: 'transcriptSummary', description: 'Conversation so far, or "just started".' },
      { name: 'lastAnswerLine', description: "The candidate's last answer, quoted; empty on the first question." },
      { name: 'jobDescriptionBlock', description: 'Labelled JD section, capped at 4000 chars; empty when the JD toggle is off.' },
      { name: 'resumeBlock', description: 'Labelled candidate background, capped at 3000 chars; empty when the resume toggle is off.' },
      { name: 'knowledgeBlock', description: 'Knowledge base + its grounding constraint, capped at 6000 chars; empty when none.' },
      { name: 'knowledgeGroundingNote', description: 'Restates the grounding rule; empty when there is no knowledge base.' },
      { name: 'hindiNote', description: 'Hindi output instruction; empty unless language is "hi".' },
    ],
    vars: ({
      jobTitle, jobDescription, department, industry, skills, experienceLevel, yearsExperience,
      interviewType, round, difficulty, askedQuestions, lastAnswer, transcriptSummary,
      questionNumber, questionCount, minutesRemaining, resumeSummary, language, knowledge,
    }) => ({
      jobTitle: jobTitle || 'n/a',
      departmentLine: department ? `\nDepartment: ${department}` : '',
      industryLine: industry ? `\nIndustry: ${industry}` : '',
      roundLine: round ? `\nInterview round: ${round}` : '',
      skillsWeightNote: skills?.some((s) => s.weight) ? ' (higher weight = more important)' : '',
      skills: (skills || [])
        .map((s) => (typeof s === 'string'
          ? s
          : `${s.name}${s.weight && s.weight !== 1 ? ` (${s.weight})` : ''}${s.required === false ? ' [nice-to-have]' : ''}`))
        .join(', ') || 'general',
      experienceLine: experienceLevel || yearsExperience
        ? `Target experience: ${experienceLevel || ''}${yearsExperience ? ` (~${yearsExperience} years)` : ''}\n`
        : '',
      difficulty,
      progressLine: questionCount
        ? `Progress: question ${questionNumber ?? '?'} of about ${questionCount}${minutesRemaining != null ? `, roughly ${minutesRemaining} minutes left` : ''}. Pace accordingly — do not start something that cannot be answered in the time left.\n`
        : '',
      askedQuestions: (askedQuestions || []).join(' | ') || 'none',
      transcriptSummary: transcriptSummary || 'just started',
      lastAnswerLine: lastAnswer ? `Candidate's last answer: "${lastAnswer}"` : '',
      jobDescriptionBlock: jobDescription
        ? `\n\nJOB DESCRIPTION — the question should probe something this role actually requires:\n"""${String(jobDescription).slice(0, 4000)}"""`
        : '',
      resumeBlock: resumeSummary
        ? `\n\nCANDIDATE BACKGROUND — you may probe their ACTUAL claimed experience. Never invent details they did not state:\n"""${String(resumeSummary).slice(0, 3000)}"""`
        : '',
      knowledgeBlock: knowledge
        ? `\n\nKNOWLEDGE BASE — you MUST base your question ONLY on the following material. Do not ask about anything outside it:\n"""${String(knowledge).slice(0, 6000)}"""`
        : '',
      interviewType,
      knowledgeGroundingNote: knowledge ? ', grounded strictly in the knowledge base above' : '',
      hindiNote: language === 'hi'
        ? 'The "question" text MUST be written in Hindi (Devanagari). Keep "expectedPoints" in English so they remain stable scoring anchors. '
        : '',
      languageLine: langLine(language),
    }),
  },

  followUp: {
    key: 'followUp',
    name: 'Follow-up decision',
    category: 'interview',
    description: 'Decides whether the last answer needs a probing follow-up, or none.',
    system: PERSONA_SYSTEM,
    template: `Question asked: "{{question}}"
Candidate answer: "{{answer}}"

If the answer is vague, incomplete, or notably strong/weak and a follow-up would add signal, write a short follow-up question. Otherwise return null.{{hindiNote}} Return JSON: {"followUp": string|null}`,
    variables: [
      ...PERSONA_VARS,
      { name: 'question', description: 'The question that was asked.' },
      { name: 'answer', description: "The candidate's answer." },
      { name: 'hindiNote', description: 'Hindi output instruction; empty unless language is "hi".' },
    ],
    vars: ({ question, answer, interviewType, language }) => ({
      question,
      answer,
      interviewType,
      hindiNote: language === 'hi' ? ' Write the follow-up question in Hindi (Devanagari).' : '',
      languageLine: langLine(language),
    }),
  },

  scoreAnswer: {
    key: 'scoreAnswer',
    name: 'Answer scoring',
    category: 'scoring',
    description: 'Scores one answer 0-100 across competencies. The JSON contract here drives every candidate score.',
    system: 'You are a rigorous, unbiased technical interviewer evaluating a candidate answer for the role of {{jobTitle}}. Score fairly; reward correctness, depth, structure, and communication. Penalize fabrication. Judge the answer on its substance regardless of the language it is written in.',
    template: `Question: "{{question}}"
Expected points (guidance, may be empty): {{expectedPoints}}
Competencies to assess: {{competencies}}
Candidate answer: "{{answer}}"

Return JSON:
{"score": number 0-100, "competencyScores": { "<competency>": number 0-100 }, "keywordsHit": string[], "keywordsMissed": string[], "reasoning": string, "followUpSuggested": string|null }{{hindiNote}}`,
    variables: [
      { name: 'jobTitle', description: 'Role the answer is judged against.' },
      { name: 'question', description: 'The question that was asked.' },
      { name: 'expectedPoints', description: 'Semicolon-separated ideal-answer points, or "use your judgment".' },
      { name: 'competencies', description: 'Comma-separated competencies to score; defaults to technical, communication.' },
      { name: 'answer', description: "The candidate's answer, or \"(no answer)\"." },
      { name: 'hindiNote', description: 'Hindi narrative instruction; empty unless language is "hi".' },
    ],
    vars: ({ jobTitle, question, expectedPoints, answer, competencies, language }) => ({
      jobTitle,
      question,
      expectedPoints: (expectedPoints || []).join('; ') || 'use your judgment',
      competencies: (competencies || ['technical', 'communication']).join(', '),
      answer: answer || '(no answer)',
      hindiNote: language === 'hi'
        ? '\nWrite "reasoning" and "followUpSuggested" in Hindi (Devanagari). Keep JSON keys, competency names, and numbers as-is.'
        : '',
    }),
  },

  finalReport: {
    key: 'finalReport',
    name: 'Final report',
    category: 'report',
    description: 'Produces the final structured evaluation, including the summary shown to the candidate.',
    system: 'You are an expert hiring assessor. Produce a fair, evidence-based final evaluation for the role of {{jobTitle}}. Base every claim on the transcript. Be specific and actionable.',
    template: `Scoring weightage: {{weightage}}
Per-answer evaluations: {{perAnswer}}
Full transcript: {{transcript}}

Return JSON:
{"scores": {"technical": n, "domain": n, "communication": n, "confidence": n, "behavioral": n, "leadership": n, "problemSolving": n, "culturalFit": n}, "overallScore": n, "strengths": string[], "weaknesses": string[], "improvementAreas": string[], "detailedFeedback": string, "candidateSummary": string, "recommendation": "strong_hire"|"hire"|"consider"|"reject"} (all scores 0-100)

"domain" is role/industry-specific knowledge, as distinct from general technical skill.
"candidateSummary" is shown TO THE CANDIDATE: 2-4 encouraging, constructive sentences on how they did and what to work on. It must never mention scores, the recommendation, or whether they are likely to be hired.{{hindiNote}}`,
    variables: [
      { name: 'jobTitle', description: 'Role being assessed.' },
      { name: 'weightage', description: 'Competency weightage as JSON.' },
      { name: 'perAnswer', description: 'Per-answer evaluations as JSON.' },
      { name: 'transcript', description: 'Full interview transcript (the caller truncates it to 20000 chars).' },
      { name: 'hindiNote', description: 'Hindi narrative instruction; empty unless language is "hi".' },
    ],
    vars: ({ jobTitle, transcript, perAnswer, weightage, language }) => ({
      jobTitle,
      weightage: JSON.stringify(weightage),
      perAnswer: JSON.stringify(perAnswer),
      transcript,
      hindiNote: language === 'hi'
        ? '\nWrite ALL narrative text — strengths, weaknesses, improvementAreas, detailedFeedback, and candidateSummary — in Hindi (Devanagari). Keep the JSON keys, the numeric scores, and the "recommendation" enum value in English.'
        : '',
    }),
  },

  generateQuestions: {
    key: 'generateQuestions',
    name: 'Bulk question generation',
    category: 'generation',
    description: 'Writes questions into the bank from a job spec. The relevance/fairness rules here are re-checked server-side.',
    system: `You are a senior {{industryLabel}} hiring expert who writes interview questions for the HireSense platform.
You write questions that a competent interviewer for THIS role would actually ask. You never pad a set with filler.

HARD RULES — a violation makes the whole set unusable:
1. RELEVANT: every question must be answerable-about and specific to the role, its skills, or the provided material. Never generic filler ("tell me about yourself"), never a question about an unrelated field.
2. NO DUPLICATES: no two questions may test the same thing, and none may restate a question in "Already in the bank" below — not even reworded.
3. CALIBRATED: match the requested difficulty and the candidate's experience level. Do not ask a fresher to design a distributed system; do not ask a principal engineer to reverse a string.
4. FAIR: nothing about age, gender, religion, marital status, caste, region, health, or politics.
5. GROUNDED: if reference material is supplied, base the questions on it and nothing else.
6. ANSWERABLE ALOUD: these are spoken interview questions{{durationNote}}.

If you cannot write {{count}} questions that satisfy every rule, return FEWER. A short, sharp set beats a padded one.{{languageLine}}`,
    template: `Role: {{jobTitle}}
Department: {{department}}
Industry: {{industry}}
Interview round: {{round}}
Key skills: {{skills}}
Experience level: {{experienceLevel}}{{yearsExperienceNote}}
Education: {{education}}
Certifications: {{certifications}}
Requested difficulty: {{difficulty}}
Requested question types: {{types}}
{{jobDescriptionBlock}}
{{resumeBlock}}
{{knowledgeBlock}}
{{existingQuestionsBlock}}

Write up to {{countLimit}} interview questions.
{{hindiNote}}{{bilingualNote}}

For each question return:
- "text": the question as asked
- "type": one of technical|hr|behavioral|situational|scenario|problem_solving|coding|mcq|aptitude|logical_reasoning|communication|domain|leadership|role_specific|true_false|short_answer|long_answer
- "difficulty": easy|medium|hard|expert
- "topic": the specific topic it probes
- "skills": the skills it tests (use the role's skill names above where they apply)
- "competencies": from technical|communication|confidence|behavioral|leadership|problemSolving|culturalFit|domain
- "expectedPoints": 3-6 concrete, checkable points a strong answer must cover
- "relevance": one sentence naming WHICH input above makes this question relevant to this role
{{mcqOptionsNote}}
Return JSON: {"questions": [{...}]}`,
    variables: [
      { name: 'industryLabel', description: 'Industry for the expert persona; falls back to "industry".' },
      { name: 'durationNote', description: 'Total time budget for the set; empty when unknown.' },
      { name: 'count', description: 'Requested number of questions.' },
      { name: 'countLimit', description: 'Requested number of questions, defaulting to 10.' },
      { name: 'languageLine', description: 'Hindi instruction; empty unless language is "hi".' },
      { name: 'jobTitle', description: 'Job title, or "n/a".' },
      { name: 'department', description: 'Department, or "n/a".' },
      { name: 'industry', description: 'Industry, or "n/a".' },
      { name: 'round', description: 'Interview round, or "general".' },
      { name: 'skills', description: 'Comma-separated skill names, or "n/a".' },
      { name: 'experienceLevel', description: 'Target experience level, or "n/a".' },
      { name: 'yearsExperienceNote', description: 'Approximate years of experience; empty when unknown.' },
      { name: 'education', description: 'Education requirement, or "n/a".' },
      { name: 'certifications', description: 'Comma-separated certifications, or "n/a".' },
      { name: 'difficulty', description: 'Requested difficulty; defaults to medium.' },
      { name: 'types', description: 'Requested question types, or "any suitable mix".' },
      { name: 'jobDescriptionBlock', description: 'Labelled JD section, capped at 6000 chars; empty when none.' },
      { name: 'resumeBlock', description: 'Labelled resume section, capped at 6000 chars; empty when none.' },
      { name: 'knowledgeBlock', description: 'Reference material + its grounding constraint, capped at 6000 chars; empty when none.' },
      { name: 'existingQuestionsBlock', description: 'Up to 60 questions already in the bank, with the no-repeat rule; empty when the bank is empty.' },
      { name: 'hindiNote', description: 'Hindi output instruction; empty unless language is "hi".' },
      { name: 'bilingualNote', description: 'English + Hindi instruction; empty unless language is "bilingual".' },
      { name: 'mcqOptionsNote', description: 'MCQ options contract; empty unless an mcq/true_false type was requested.' },
    ],
    vars: ({
      jobTitle, jobDescription, department, industry, skills, resumeText, experienceLevel,
      yearsExperience, education, certifications, round, difficulty, count, durationMinutes,
      language, types, existingQuestions, knowledge,
    }) => ({
      industryLabel: industry || 'industry',
      durationNote: durationMinutes ? `, and the whole set must fit roughly ${durationMinutes} minutes` : '',
      count,
      countLimit: count || 10,
      languageLine: langLine(language),
      jobTitle: jobTitle || 'n/a',
      department: department || 'n/a',
      industry: industry || 'n/a',
      round: round || 'general',
      skills: (skills || []).join(', ') || 'n/a',
      experienceLevel: experienceLevel || 'n/a',
      yearsExperienceNote: yearsExperience ? ` (~${yearsExperience} years)` : '',
      education: education || 'n/a',
      certifications: (certifications || []).join(', ') || 'n/a',
      difficulty: difficulty || 'medium',
      types: (types || []).join(', ') || 'any suitable mix',
      jobDescriptionBlock: jobDescription ? `\nJob description:\n"""${String(jobDescription).slice(0, 6000)}"""` : '',
      resumeBlock: resumeText
        ? `\nCandidate resume — tailor some questions to this person's ACTUAL background:\n"""${String(resumeText).slice(0, 6000)}"""`
        : '',
      knowledgeBlock: knowledge ? `\nREFERENCE MATERIAL — base every question ONLY on this:\n"""${String(knowledge).slice(0, 6000)}"""` : '',
      existingQuestionsBlock: existingQuestions?.length
        ? `\nAlready in the bank — do NOT repeat or reword any of these:\n${existingQuestions.slice(0, 60).map((q) => `- ${q}`).join('\n')}`
        : '',
      hindiNote: language === 'hi'
        ? 'Write "text" in Hindi (Devanagari); keep technical terms in English where natural. Keep expectedPoints in English so they stay stable scoring anchors.'
        : '',
      bilingualNote: language === 'bilingual'
        ? 'Write "text" in English and "textHi" in Hindi (Devanagari) — the same question in both languages.'
        : '',
      mcqOptionsNote: (types || []).some((t) => ['mcq', 'true_false'].includes(t))
        ? '- "options": for mcq/true_false only — [{"text": string, "isCorrect": boolean}] with exactly one correct unless the question says otherwise\n'
        : '',
    }),
  },

  generateAnswerKey: {
    key: 'generateAnswerKey',
    name: 'Answer key',
    category: 'generation',
    description: 'Builds the ideal answer, key points, indicators, follow-ups and rubric for one question.',
    system: `You are a senior interviewer writing the answer key an interviewer will grade against for the role of {{roleLabel}}.
Be concrete and checkable. The key must let a non-expert interviewer tell a strong answer from a weak one without knowing the field.{{languageLine}}`,
    template: `Question: "{{question}}"
Role: {{jobTitle}}
Key skills: {{skills}}
Difficulty: {{difficulty}}
Competencies assessed: {{competencies}}

Return JSON:
{"idealAnswer": string (what a strong answer says, 4-8 sentences),
 "keyPoints": string[] (3-6 concrete points a strong answer MUST cover),
 "expectedSkills": string[],
 "strongIndicators": string[] (what marks an excellent answer),
 "weakIndicators": string[] (red flags / common wrong turns),
 "followUps": string[] (2-3 probing follow-ups),
 "rubric": [{"band": "excellent"|"good"|"average"|"poor", "min": number, "max": number, "descriptor": string}] (bands covering 0-100 with no gaps),
 "interviewerNotes": string (what to listen for, 1-3 sentences)}{{hindiNote}}`,
    variables: [
      { name: 'roleLabel', description: 'Role for the persona line; falls back to "this role".' },
      { name: 'languageLine', description: 'Hindi instruction; empty unless language is "hi".' },
      { name: 'question', description: 'The question to build a key for.' },
      { name: 'jobTitle', description: 'Job title, or "n/a".' },
      { name: 'skills', description: 'Comma-separated skills, or "n/a".' },
      { name: 'difficulty', description: 'Question difficulty; defaults to medium.' },
      { name: 'competencies', description: 'Comma-separated competencies assessed, or "n/a".' },
      { name: 'hindiNote', description: 'Hindi output instruction; empty unless language is "hi".' },
    ],
    vars: ({ question, jobTitle, skills, difficulty, competencies, language }) => ({
      roleLabel: jobTitle || 'this role',
      languageLine: langLine(language),
      question,
      jobTitle: jobTitle || 'n/a',
      skills: (skills || []).join(', ') || 'n/a',
      difficulty: difficulty || 'medium',
      competencies: (competencies || []).join(', ') || 'n/a',
      hindiNote: language === 'hi'
        ? '\nWrite "idealAnswer", "interviewerNotes" and the rubric descriptors in Hindi (Devanagari). Keep "keyPoints" in English as stable scoring anchors.'
        : '',
    }),
  },

  analyzeResume: {
    key: 'analyzeResume',
    name: 'Resume analysis',
    category: 'resume',
    description: 'ATS scoring, job match and structured candidate extraction from resume text.',
    system: 'You are an ATS + resume-parsing engine and technical recruiter. Analyze the resume objectively against the target role AND extract structured candidate data. Only extract fields that genuinely appear in the resume — never fabricate contact details, salary, or employers. Use "" or [] when a field is not present.',
    template: `Target role: {{jobTitle}}
Required skills: {{requiredSkills}}
Resume text:
"""{{resumeText}}"""

Return ONLY JSON:
{"extractedSkills": string[], "missingSkills": string[], "yearsExperience": number, "atsScore": number 0-100, "jobMatch": number 0-100, "summary": string, "strengths": string[], "redFlags": string[], "parsed": {"fullName": string, "email": string, "phone": string, "whatsapp": string, "address": string, "city": string, "state": string, "country": string, "nationality": string, "linkedin": string, "website": string, "currentCompany": string, "currentDesignation": string, "totalExperienceYears": number, "highestQualification": string, "languages": string[], "certifications": [{"name": string, "issuer": string, "year": string}], "education": [{"degree": string, "institution": string, "field": string, "startYear": number, "endYear": number}], "workExperience": [{"title": string, "company": string, "startDate": string, "endDate": string, "current": boolean, "description": string}], "projects": [{"name": string, "description": string, "url": string}]}}`,
    variables: [
      { name: 'jobTitle', description: 'Target role, or "general".' },
      { name: 'requiredSkills', description: 'Comma-separated required skills, or "n/a".' },
      { name: 'resumeText', description: 'Extracted resume text, capped at 14000 chars.' },
    ],
    vars: ({ resumeText, jobTitle, requiredSkills }) => ({
      jobTitle: jobTitle || 'general',
      requiredSkills: (requiredSkills || []).join(', ') || 'n/a',
      resumeText: (resumeText || '').slice(0, 14000),
    }),
  },
};

export default DEFAULT_PROMPTS;
