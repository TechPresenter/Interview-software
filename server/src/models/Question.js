import mongoose from 'mongoose';
import {
  QUESTION_TYPES,
  INDUSTRIES,
  QUESTION_STATUS,
  QUESTION_SOURCES,
  DIFFICULTY,
  EXPERIENCE_LEVELS,
} from '../constants/enums.js';

const { Schema } = mongoose;

/**
 * A bank question.
 *
 * TAXONOMY NOTE: `type` is the FORMAT (technical / mcq / behavioural …) and
 * `category` is the INDUSTRY (software_development / healthcare / banking …).
 * The two used to be conflated in `category`, whose 6 legacy values were really
 * types — `scripts/migrate-question-taxonomy.js` copies those into `type` and
 * frees `category` for industries. Both are optional so pre-migration docs stay
 * loadable.
 */
const questionSchema = new Schema(
  {
    // null company => global bank (super_admin); set => company-private.
    company: { type: Schema.Types.ObjectId, ref: 'Company', index: true, default: null },
    /** Global questions can be marked public so other companies may use them. */
    isPublic: { type: Boolean, default: true, index: true },

    /* ── Taxonomy ── */
    type: { type: String, enum: QUESTION_TYPES, default: 'technical', index: true },
    category: { type: String, enum: [...INDUSTRIES, null], default: null, index: true },
    topic: { type: String, index: true },
    jobRole: { type: String, index: true },
    department: { type: String },
    experienceLevel: { type: String, enum: [...EXPERIENCE_LEVELS, null], default: null, index: true },
    difficulty: { type: String, enum: DIFFICULTY, default: 'medium', index: true },
    /** Natural language of the question text. Distinct from `coding.language`. */
    language: { type: String, enum: ['en', 'hi', 'bilingual'], default: 'en', index: true },

    text: { type: String, required: true },
    skills: [String], // doubles as the tag array (matched against job requirements)

    /* ── Type-specific structure ── */
    coding: {
      language: String, // PROGRAMMING language
      starterCode: String,
      testCases: [{ input: String, expectedOutput: String, hidden: Boolean }],
    },
    /** MCQ / true-false options. Mirrors the `coding` subdoc precedent. */
    mcq: {
      options: [{ text: String, isCorrect: Boolean }],
      multiSelect: { type: Boolean, default: false },
    },

    /* ── Evaluation guidance ── */
    // The ideal-answer key the scoring engine compares answers against.
    expectedPoints: [String],
    competencies: [String], // which competencies this question probes

    /** Rich AI-generated answer key (spec item 5). `expectedPoints` stays the
     *  scoring anchor and is kept in sync from `answerKey.keyPoints`. */
    answerKey: {
      idealAnswer: String,
      keyPoints: [String],
      expectedSkills: [String],
      strongIndicators: [String],
      weakIndicators: [String],
      followUps: [String],
      rubric: [{ band: String, min: Number, max: Number, descriptor: String }],
      interviewerNotes: String,
      generatedAt: Date,
    },

    /* ── Moderation / provenance ── */
    status: { type: String, enum: QUESTION_STATUS, default: 'approved', index: true },
    source: { type: String, enum: QUESTION_SOURCES, default: 'manual', index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },

    isActive: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null, index: true },
    archivedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    /* ── Usage analytics ── */
    usageCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// Selection path: type + difficulty + status + active.
questionSchema.index({ type: 1, difficulty: 1, status: 1, isActive: 1 });
questionSchema.index({ company: 1, status: 1, isActive: 1 });
questionSchema.index({ text: 'text', skills: 'text', topic: 'text' });

/** Keep the legacy scoring anchor in sync with the richer answer key. */
questionSchema.pre('save', function syncExpectedPoints(next) {
  const keyPoints = this.answerKey?.keyPoints;
  if (keyPoints?.length && !this.expectedPoints?.length) this.expectedPoints = keyPoints;
  next();
});

export const Question = mongoose.model('Question', questionSchema);
export default Question;
