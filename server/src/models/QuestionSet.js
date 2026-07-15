import mongoose from 'mongoose';
import { DIFFICULTY, INTERVIEW_ROUNDS, EXPERIENCE_LEVELS } from '../constants/enums.js';

const { Schema } = mongoose;

/**
 * A named, ordered collection of bank questions — the recruiter-curated
 * alternative to letting the engine pick each question live.
 *
 * Deliberately stores REFERENCES, not copies: editing a question or its answer
 * key updates every set that uses it. `Interview.questionSet` (when set) makes
 * the interview deterministic and repeatable across candidates, which is what
 * makes a comparison between two candidates fair.
 */
const questionSetSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', index: true, default: null },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, maxlength: 1000 },

    questions: [{ type: Schema.Types.ObjectId, ref: 'Question' }],

    // Metadata for finding the right set later.
    jobRole: { type: String, index: true },
    department: { type: String },
    round: { type: String, enum: [...INTERVIEW_ROUNDS, null], default: null, index: true },
    difficulty: { type: String, enum: [...DIFFICULTY, null], default: null },
    experienceLevel: { type: String, enum: [...EXPERIENCE_LEVELS, null], default: null },
    language: { type: String, enum: ['en', 'hi', 'bilingual'], default: 'en' },
    tags: [String],

    /** Global sets (company: null) may be shared with every company. */
    isPublic: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },

    usageCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

questionSetSchema.index({ company: 1, isActive: 1 });
questionSetSchema.index({ name: 'text', tags: 'text' });

/** Convenience for list views — avoids populating just to show a count. */
questionSetSchema.virtual('questionCount').get(function count() {
  return this.questions?.length || 0;
});
questionSetSchema.set('toJSON', { virtuals: true });
questionSetSchema.set('toObject', { virtuals: true });

export const QuestionSet = mongoose.model('QuestionSet', questionSetSchema);
export default QuestionSet;
