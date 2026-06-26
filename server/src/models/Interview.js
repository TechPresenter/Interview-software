import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import { INTERVIEW_TYPES, INTERVIEW_STATUS } from '../constants/enums.js';

const { Schema } = mongoose;

/** A single proctoring/anti-cheat event captured during the interview. */
const proctoringEventSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        'tab_switch',
        'window_blur',
        'fullscreen_exit',
        'copy',
        'paste',
        'right_click',
        'face_missing',
        'multiple_faces',
        'no_audio',
      ],
      required: true,
    },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    at: { type: Date, default: Date.now },
    detail: Schema.Types.Mixed,
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
    status: { type: String, enum: INTERVIEW_STATUS, default: 'scheduled', index: true },

    config: {
      durationMinutes: { type: Number, default: 30 },
      questionCount: { type: Number, default: 8 },
      adaptiveDifficulty: { type: Boolean, default: true },
      proctoring: { type: Boolean, default: true },
      voiceEnabled: { type: Boolean, default: true },
      language: { type: String, enum: ['en', 'hi'], default: 'en' },
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
      skipsUsed: { type: Number, default: 0 },
      // The question currently awaiting an answer.
      pendingQuestion: {
        text: String,
        competencies: [String],
        isFollowUp: { type: Boolean, default: false },
      },
    },

    // Ordered transcript of the conversation (AI + candidate turns).
    transcript: [
      {
        role: { type: String, enum: ['ai', 'candidate', 'system'] },
        text: String,
        at: { type: Date, default: Date.now },
      },
    ],

    recordings: {
      videoUrl: String,
      audioUrl: String,
    },

    proctoring: {
      integrityScore: { type: Number, default: 100, min: 0, max: 100 },
      events: [proctoringEventSchema],
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
