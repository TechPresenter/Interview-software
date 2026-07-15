import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import { INTERVIEW_TYPES, INTERVIEW_STATUS, INTERVIEW_ROUNDS } from '../constants/enums.js';

const { Schema } = mongoose;

/**
 * A single proctoring/anti-cheat event captured during the interview.
 * `type` is a free string validated against proctoring.service SCORE_WEIGHTS —
 * kept open (no enum) so new detectors can be added without a schema migration.
 */
const proctoringEventSchema = new Schema(
  {
    type: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    at: { type: Date, default: Date.now },
    detail: Schema.Types.Mixed,
    screenshotUrl: { type: String }, // evidence captured at the moment of the event
  },
  { _id: false },
);

const interviewSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    job: { type: Schema.Types.ObjectId, ref: 'Job', index: true },
    candidate: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
    // Optional knowledge base grounding this interview's questions (overrides the job's).
    knowledgeBase: { type: Schema.Types.ObjectId, ref: 'KnowledgeBase', default: null },

    // Public, unguessable token used in the candidate invite link.
    accessToken: { type: String, unique: true, default: () => nanoid(24), index: true },

    types: [{ type: String, enum: INTERVIEW_TYPES }],
    /** Which round this is. Drives question selection + report framing. */
    round: { type: String, enum: INTERVIEW_ROUNDS, default: 'technical' },
    status: { type: String, enum: INTERVIEW_STATUS, default: 'scheduled', index: true },

    /**
     * A fixed, ordered set of questions. When present the engine serves these in
     * order instead of ranking the bank live — every candidate gets the exact
     * same questions, which is what makes comparing them fair.
     */
    questionSet: { type: Schema.Types.ObjectId, ref: 'QuestionSet', default: null },

    config: {
      language: { type: String, enum: ['en', 'hi'], default: 'en' },
      // When false, the candidate CANNOT switch language mid-interview — the
      // scheduled language is enforced end-to-end for full consistency.
      allowLanguageChange: { type: Boolean, default: false },
      durationMinutes: { type: Number, default: 30 },
      questionCount: { type: Number, default: 8 },
      // 'expert' completes the ladder that engine.adaptDifficulty already steps along.
      difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'expert'], default: 'medium' },
      experienceLevel: { type: String }, // e.g. fresher | mid | senior
      /**
       * How many background questions to ask before the first scored one.
       *   undefined → auto (sized by questionCount and duration; never zero)
       *   0         → off. The single lever an admin has to opt out.
       *   1..3      → honoured verbatim
       * No default: `undefined` must stay distinguishable from `0`.
       */
      introCount: { type: Number },
      adaptiveDifficulty: { type: Boolean, default: true },
      followUps: { type: Boolean, default: true }, // AI follow-up questions
      randomOrder: { type: Boolean, default: false },
      passingScore: { type: Number, default: 50, min: 0, max: 100 },
      timePerQuestionSeconds: { type: Number, default: 0 }, // 0 = no per-question limit
      autoSubmit: { type: Boolean, default: true }, // auto-submit on time expiry
      maxRetries: { type: Number, default: 0 },

      // Media / device requirements.
      voiceEnabled: { type: Boolean, default: true },
      videoEnabled: { type: Boolean, default: true },
      cameraRequired: { type: Boolean, default: true },
      micRequired: { type: Boolean, default: true },
      proctoring: { type: Boolean, default: true }, // anti-cheating

      // Question generation grounding.
      resumeBased: { type: Boolean, default: false },
      jdBased: { type: Boolean, default: true },
      // Prefer curated bank questions over LLM-invented ones. Off => pure AI.
      useQuestionBank: { type: Boolean, default: true },

      allowSkip: { type: Boolean, default: true },
      maxSkips: { type: Number, default: 2 },
    },

    scheduledAt: { type: Date },
    expiresAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },

    // Live state for the AI interview engine (also mirrored in Redis while live).
    engineState: {
      currentIndex: { type: Number, default: 0 },
      difficulty: { type: String, default: 'medium' },
      phase: {
        type: String,
        enum: ['greeting', 'questioning', 'follow_up', 'closing', 'done'],
        default: 'greeting',
      },
      askedQuestionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
      askedTexts: [String], // de-dupe topics across turns
      // Running ledger of what has been probed, so the engine can see coverage
      // rather than only the last couple of turns.
      competenciesCovered: [String],
      skipsUsed: { type: Number, default: 0 },
      /**
       * The background stages planned for this interview, resolved once in
       * start() and then fixed. Empty for every interview scheduled before this
       * shipped, which is what makes the change migration-free: `introAsked (0)
       * < introPlan.length (0)` is false, so a live interview never enters the
       * intro path and behaves exactly as it did.
       */
      introPlan: [String],
      /** How many background STAGES have been answered (follow-ups don't count). */
      introAsked: { type: Number, default: 0 },
      /**
       * Whether the background questions address an early-career candidate.
       * Resolved once in start() (the only place the candidate doc is loaded)
       * so the wording stays stable for the whole interview.
       */
      introFresher: { type: Boolean, default: false },
      // The question currently awaiting an answer.
      pendingQuestion: {
        text: String,
        competencies: [String],
        isFollowUp: { type: Boolean, default: false },
        /**
         * A background/warm-up turn rather than a scored question.
         *
         * This line is load-bearing, not documentation. `pendingQuestion` is a
         * nested path with declared leaves and no `strict: false`, so mongoose
         * strips any undeclared key AT ASSIGNMENT — in memory, before a save is
         * even attempted. Set `isIntro` without declaring it and it reads back
         * `undefined`, every `if (!pending.isIntro)` guard passes, and the intro
         * silently scores itself and eats the question budget: exactly the
         * behaviour the flag exists to prevent, with no error anywhere.
         */
        isIntro: { type: Boolean, default: false },
        // Set when the question came from the Question bank (enables usage
        // analytics + joining answers back to bank questions).
        questionId: { type: Schema.Types.ObjectId, ref: 'Question' },
        // Key points a strong answer should cover. Anchors scoring so the
        // evaluator compares against an ideal answer instead of guessing.
        expectedPoints: [String],
        // Why the interviewer chose this question — surfaced as interviewer notes.
        rationale: String,
      },
    },

    // Ordered transcript of the conversation (AI + candidate turns).
    transcript: [
      {
        role: { type: String, enum: ['ai', 'candidate', 'system'] },
        text: String,
        at: { type: Date, default: Date.now },
        /**
         * Marks a background turn. The recruiter reads the whole transcript, but
         * the report's LLM must not: report.engine prefers the model's own
         * `recommendation`, and it is fed the transcript — so without this flag,
         * unscoring the intro protects the numbers while small talk still
         * reaches the hire/reject verdict.
         */
        intro: { type: Boolean, default: false },
      },
    ],

    recordings: {
      videoUrl: String,
      audioUrl: String,
    },

    proctoring: {
      integrityScore: { type: Number, default: 100, min: 0, max: 100 },
      fraudScore: { type: Number, default: 0, min: 0, max: 100 },
      riskLevel: { type: String, enum: ['safe', 'low', 'medium', 'high', 'critical'], default: 'safe' },
      attentionScore: { type: Number, default: 100, min: 0, max: 100 },
      eyeContactPct: { type: Number, min: 0, max: 100 },
      events: [proctoringEventSchema],

      // Identity verification (§1) — populated in Phase 2 (MediaPipe/face-match).
      identity: {
        verified: { type: Boolean, default: false },
        faceMatch: { type: Number, min: 0, max: 100 }, // % match vs profile photo
        livenessPassed: { type: Boolean },
        method: { type: String }, // e.g. 'blink', 'smile', 'head'
      },

      // Device & browser fingerprint (§10).
      device: {
        browser: String,
        browserVersion: String,
        os: String,
        deviceType: String, // desktop | mobile | tablet
        screenResolution: String,
        viewport: String,
        cpuCores: Number,
        ram: Number, // GB (navigator.deviceMemory, approximate)
        userAgent: String,
        language: String,
        timezone: String,
      },

      // Network & approximate geo (§10) — geo only with the candidate's permission.
      network: {
        ip: String,
        country: String,
        region: String,
        city: String,
        lat: Number,
        lng: Number,
        networkType: String, // 4g, wifi, etc.
        isp: String,
        vpn: { type: Boolean, default: false },
        downlinkMbps: Number,
      },

      // Screenshots / webcam snapshots captured on violations (§13).
      evidence: [
        {
          _id: false,
          type: { type: String }, // screenshot | webcam | id_card
          reason: String, // the trigger (e.g. multiple_faces)
          url: String,
          at: { type: Date, default: Date.now },
        },
      ],
    },

    report: { type: Schema.Types.ObjectId, ref: 'Report' },

    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

interviewSchema.index({ company: 1, status: 1, scheduledAt: -1 });

/** Recompute integrity score from accumulated events (called on each event). */
interviewSchema.methods.recomputeIntegrity = function recomputeIntegrity() {
  const weights = { low: 2, medium: 6, high: 15 };
  const penalty = this.proctoring.events.reduce(
    (sum, e) => sum + (weights[e.severity] || 2),
    0,
  );
  this.proctoring.integrityScore = Math.max(0, 100 - penalty);
  return this.proctoring.integrityScore;
};

export const Interview = mongoose.model('Interview', interviewSchema);
export default Interview;
