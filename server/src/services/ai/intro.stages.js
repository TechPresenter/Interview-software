/**
 * The background phase — what the AI asks before it asks anything technical.
 *
 * WHY THIS IS DATA AND NOT A PROMPT
 * ---------------------------------
 * Every other question in this product is authored by the LLM or picked from the
 * bank. Background questions are neither, for three reasons:
 *
 *  1. The prompts forbid it. `nextQuestion` says "It MUST be directly relevant to
 *     the role and skills above — never generic filler", and `generateQuestions`
 *     HARD RULE 1 says "Never generic filler ('tell me about yourself')". Asking
 *     the LLM for the exact thing its instructions forbid is incoherent.
 *  2. Determinism. An assigned QuestionSet promises "every candidate gets the
 *     exact same questions, which is what makes comparing them fair". Static
 *     seeds keep the opening byte-identical for everyone; an LLM-written intro
 *     would not be.
 *  3. Cost. Three fixed strings do not need a model call each.
 *
 * WHY THREE STAGES AND NOT EIGHT
 * ------------------------------
 * The spec lists eight background topics. Eight sequential turns — "now your
 * education", "now your certifications" — is a form read aloud, not an
 * interview, and it would cost more turns than the technical questions it is
 * meant to precede. A real interviewer merges: "walk me through your background"
 * collects the personal introduction, education AND work history in one answer,
 * and gets better signal because the candidate picks the through-line.
 *
 * All eight topics are still covered, by name, in three questions:
 *
 *   spec 1  greeting + candidate introduction → engine.greet(), already exists
 *   spec 2  personal introduction             → background
 *   spec 3  educational background            → background
 *   spec 4  work experience / internships     → background
 *   spec 5  projects and achievements         → projects
 *   spec 6  skills and certifications         → projects
 *   spec 7  career goals and motivation       → motivation
 *   spec 8  role-specific experience          → motivation (clause dropped if no job)
 *   spec 9  transition to technical           → BRIDGE, a sentence on the first
 *                                               scored question, not a turn
 *
 * Certifications are folded into "which of your skills it leaned on" rather than
 * getting a turn of their own: "list your certifications" harvests a list the
 * parsed resume already holds, which is no signal and reads like a bot.
 */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/**
 * The stages, in order. `text`/`textHi` are functions of a small context so a
 * stage can reword — never skip. Three broad questions are always answerable,
 * which is why there is no skip logic here at all.
 */
export const INTRO_STAGES = [
  {
    id: 'background', // spec 2 + 3 + 4
    competencies: ['communication'],
    text: ({ fresher }) => (fresher
      ? 'To start, tell me a bit about yourself — what you studied, and the internships or projects that got you interested in this kind of work.'
      : 'To start, tell me a bit about yourself — your background, what you studied, and the work or internships that brought you here.'),
    textHi: ({ fresher }) => (fresher
      ? 'शुरुआत में, अपने बारे में कुछ बताइए — आपने क्या पढ़ाई की, और किन इंटर्नशिप या प्रोजेक्ट्स ने आपको इस क्षेत्र में रुचि दिलाई।'
      : 'शुरुआत में, अपने बारे में कुछ बताइए — आपकी पृष्ठभूमि, आपने क्या पढ़ाई की, और किस काम या इंटर्नशिप ने आपको यहाँ तक पहुँचाया।'),
  },
  {
    id: 'projects', // spec 5 + 6
    competencies: ['communication'],
    // "project OR piece of work" on purpose: a fresher with coursework and a
    // staff engineer with production systems must both be able to answer it.
    text: () => 'Pick one project or piece of work you are proud of and walk me through it — what you built, what was hard, and which of your skills it leaned on.',
    textHi: () => 'कोई एक प्रोजेक्ट या काम चुनिए जिस पर आपको गर्व है — आपने क्या बनाया, क्या मुश्किल था, और उसमें आपके कौन से कौशल काम आए।',
  },
  {
    id: 'motivation', // spec 7 + 8
    competencies: ['communication'],
    // Spec 8's "(if applicable)" attaches to role-specific experience, not to
    // career goals — so with no job attached the role clause drops and the
    // question stands.
    text: ({ jobTitle }) => (jobTitle
      ? `What draws you to this ${jobTitle} role, and where do you want to take your career over the next couple of years?`
      : 'Where do you want to take your career over the next couple of years?'),
    textHi: ({ jobTitle }) => (jobTitle
      ? `आपको इस ${jobTitle} भूमिका की ओर क्या आकर्षित करता है, और अगले कुछ वर्षों में आप अपने करियर को कहाँ ले जाना चाहते हैं?`
      : 'अगले कुछ वर्षों में आप अपने करियर को कहाँ ले जाना चाहते हैं?'),
  },
];

const STAGE_BY_ID = new Map(INTRO_STAGES.map((s) => [s.id, s]));

/** Spec stage 9. A sentence, not a question — "gradually move" costs no turn. */
export const bridge = ({ jobTitle, language } = {}) => (language === 'hi'
  ? `धन्यवाद — मुझे आपकी पृष्ठभूमि की अच्छी तस्वीर मिल गई। अब ${jobTitle || 'भूमिका'} से जुड़े सवालों की ओर बढ़ते हैं।`
  : `Thanks — that gives me a good picture of where you are coming from. Let's move into the ${jobTitle || 'role'} side of things.`);

/**
 * How many background questions this interview gets.
 *
 * Background is ADDITIVE — it never touches `currentIndex`, so `questionCount`
 * keeps its single meaning of "scored questions" and the intro can't crowd out
 * the technical interview. What it can crowd is the clock, which is why duration
 * is a term.
 *
 * The floor of 1 is requirement 1's "always": questionCount and duration may
 * SIZE the intro, never delete it. `introCount: 0` is the only path to zero, and
 * it is requirement 5's "unless an admin explicitly customizes".
 *
 * Deliberately NOT keyed on interview type. Requirement 5 names "all interview
 * types" as an axis where the flow must be CONSISTENT, so auto-shrinking the
 * intro for a coding round is the per-type inconsistency the requirement
 * forbids — and it isn't an admin customizing anything. The clock does that job
 * honestly instead: a 15-minute screen gets 1 via floor(duration / 10).
 */
export function introCountFor(config = {}) {
  if (config.introCount != null) return clamp(config.introCount, 0, INTRO_STAGES.length);
  return Math.max(1, Math.min(
    INTRO_STAGES.length,
    Math.ceil((config.questionCount || 8) / 3),
    Math.floor((config.durationMinutes || 30) / 10),
  ));
}

/**
 * Is this candidate early-career? Requires POSITIVE evidence.
 *
 * `candidate.experience[]` is deliberately not consulted: resume.analyzer only
 * populates it on a successful AI parse (`if (exp.length)`), so absence is the
 * common case, not a signal. Inferring "fresher" from missing data asks a
 * twelve-year staff engineer, on turn one, about "the internships that got you
 * interested" — the exact insulting question this product promises never to ask,
 * aimed at the candidates it most wants to impress. Silence means neutral.
 */
export function isFresher({ config = {}, candidate } = {}) {
  if (config.experienceLevel) return config.experienceLevel === 'fresher'; // the recruiter knows
  if (candidate?.totalExperienceYears === 0) return true; // a real, stated zero
  return false;
}

/** The ordered stage ids for this interview. */
export function planFor({ config = {} } = {}) {
  return INTRO_STAGES.slice(0, introCountFor(config)).map((s) => s.id);
}

/**
 * Build one background question in the engine's pendingQuestion shape.
 * Carries no `questionId` — it is not a bank question, so it must never touch
 * askedQuestionIds or a QuestionSet's progress.
 */
export function introQuestion(stageId, { jobTitle, fresher, language } = {}) {
  const stage = STAGE_BY_ID.get(stageId);
  if (!stage) return null;
  const ctx = { jobTitle, fresher };
  return {
    text: language === 'hi' ? stage.textHi(ctx) : stage.text(ctx),
    competencies: stage.competencies,
    isIntro: true,
    isFollowUp: false,
    // No expectedPoints: there is no right answer to "tell me about yourself",
    // and the field is the scorer's anchor — which never runs for these.
    expectedPoints: [],
    rationale: 'Background question — collects context before the role-specific questions.',
  };
}

export default { INTRO_STAGES, bridge, introCountFor, isFresher, planFor, introQuestion };
