import mongoose from 'mongoose';
import { QUESTION_CATEGORIES, DIFFICULTY } from '../constants/enums.js';

const { Schema } = mongoose;

const questionSchema = new Schema(
  {
    // null company => global bank (managed by super_admin); set => company-private.
    company: { type: Schema.Types.ObjectId, ref: 'Company', index: true, default: null },

    category: { type: String, enum: QUESTION_CATEGORIES, required: true, index: true },
    difficulty: { type: String, enum: DIFFICULTY, default: 'medium', index: true },

    text: { type: String, required: true },
    skills: [String], // tags for matching to job requirements

    // Coding questions carry extra structure.
    coding: {
      language: String,
      starterCode: String,
      testCases: [{ input: String, expectedOutput: String, hidden: Boolean }],
    },

    // Guidance the scoring engine uses to evaluate answers.
    expectedPoints: [String],
    competencies: [String], // which competencies this question probes

    isActive: { type: Boolean, default: true },
    usageCount: { type: Number, default: 0 },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

questionSchema.index({ category: 1, difficulty: 1, isActive: 1 });
questionSchema.index({ text: 'text', skills: 'text' });

export const Question = mongoose.model('Question', questionSchema);
export default Question;
