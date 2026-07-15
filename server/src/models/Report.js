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
      domain: Number,
      communication: Number,
      confidence: Number,
      behavioral: Number,
      leadership: Number,
      problemSolving: Number,
      culturalFit: Number,
    },
    overallScore: { type: Number, min: 0, max: 100, index: true },

    /**
     * Per-question breakdown. The scoring engine always produced this detail and
     * stored it on each Answer, but the report only ever showed the aggregate —
     * so a recruiter could see a 62 with no way to find out which answers cost
     * the candidate the points.
     */
    perQuestion: [
      {
        order: Number,
        question: { type: Schema.Types.ObjectId, ref: 'Question' },
        questionText: String,
        answerText: String,
        score: Number,
        competencies: [String],
        expectedPoints: [String],
        covered: [String], // expected points the answer actually hit
        missed: [String], // expected points the answer did not address
        reasoning: String,
        isFollowUp: Boolean,
        skipped: Boolean,
        durationSeconds: Number,
      },
    ],

    /** How much of the job's required skills the interview actually probed. */
    skillCoverage: [{ skill: String, asked: Number, score: Number }],

    strengths: [String],
    weaknesses: [String],
    improvementAreas: [String],
    detailedFeedback: { type: String },
    /** Candidate-facing summary — safe to share, no scores or hiring signal. */
    candidateSummary: { type: String },

    /** Human notes added by recruiters on top of the AI evaluation. */
    recruiterNotes: [
      {
        author: { type: Schema.Types.ObjectId, ref: 'User' },
        authorName: String,
        note: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    recommendation: { type: String, enum: RECOMMENDATIONS, index: true },
    /** Language the narrative was written in. */
    language: { type: String, enum: ['en', 'hi'], default: 'en' },

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
