import mongoose from 'mongoose';
import { RECOMMENDATIONS } from '../constants/enums.js';

const { Schema } = mongoose;

/** Final AI-generated evaluation report for a completed interview. */
const reportSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    interview: { type: Schema.Types.ObjectId, ref: 'Interview', required: true, unique: true },
    candidate: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
    job: { type: Schema.Types.ObjectId, ref: 'Job', index: true },

    // 0–100 per competency.
    scores: {
      technical: Number,
      communication: Number,
      confidence: Number,
      behavioral: Number,
      leadership: Number,
      problemSolving: Number,
      culturalFit: Number,
    },
    overallScore: { type: Number, min: 0, max: 100, index: true },

    strengths: [String],
    weaknesses: [String],
    improvementAreas: [String],
    detailedFeedback: { type: String },

    recommendation: { type: String, enum: RECOMMENDATIONS, index: true },

    // Snapshot of how scores were weighted (auditable, from AI config).
    weightage: { type: Schema.Types.Mixed },

    integrityScore: { type: Number },
    generatedBy: { type: String, default: 'ai' },
    model: { type: String },
  },
  { timestamps: true },
);

reportSchema.index({ company: 1, overallScore: -1 });

export const Report = mongoose.model('Report', reportSchema);
export default Report;
