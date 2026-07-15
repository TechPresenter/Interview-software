import mongoose from 'mongoose';

const { Schema } = mongoose;

/** A candidate's response to one question, plus the AI's per-answer evaluation. */
const answerSchema = new Schema(
  {
    interview: { type: Schema.Types.ObjectId, ref: 'Interview', required: true, index: true },
    question: { type: Schema.Types.ObjectId, ref: 'Question' },
    // Snapshot of the prompt actually asked (it may be AI-generated / adapted).
    questionText: { type: String, required: true },
    // Snapshotted alongside the text so the report can explain what was being
    // probed and what a strong answer needed — even if the bank question is
    // later edited or archived.
    competencies: [String],
    expectedPoints: [String],
    isFollowUp: { type: Boolean, default: false },
    skipped: { type: Boolean, default: false },

    response: { type: String, default: '' }, // transcribed/typed answer
    audioUrl: String,
    durationSeconds: Number,

    // Scoring engine output for this single answer.
    evaluation: {
      score: { type: Number, min: 0, max: 100 },
      competencyScores: { type: Map, of: Number },
      reasoning: String,
      keywordsHit: [String],
      keywordsMissed: [String],
      followUpSuggested: String,
    },

    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

answerSchema.index({ interview: 1, order: 1 });

export const Answer = mongoose.model('Answer', answerSchema);
export default Answer;
