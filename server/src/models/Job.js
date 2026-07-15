import mongoose from 'mongoose';
import {
  JOB_STATUS,
  INDUSTRIES,
  INTERVIEW_ROUNDS,
  DIFFICULTY,
  EXPERIENCE_LEVELS,
} from '../constants/enums.js';

const { Schema } = mongoose;

const skillSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    weight: { type: Number, default: 1, min: 0, max: 10 }, // importance for matching
    required: { type: Boolean, default: true },
  },
  { _id: false },
);

const jobSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, index: true },
    department: { type: String },
    /** Drives industry-relevant question selection + generation. */
    industry: { type: String, enum: [...INDUSTRIES, null], default: null, index: true },
    location: { type: String },
    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'internship', 'temporary'],
      default: 'full_time',
    },
    workMode: { type: String, enum: ['onsite', 'remote', 'hybrid'], default: 'onsite' },

    description: { type: String },
    responsibilities: [String],
    skills: [skillSchema],

    experience: {
      min: { type: Number, default: 0 },
      max: { type: Number },
    },
    salary: {
      min: { type: Number },
      max: { type: Number },
      currency: { type: String, default: 'USD' },
    },

    // Default interview blueprint used when auto-scheduling for this job.
    interviewConfig: {
      types: [{ type: String }], // e.g. ['hr','technical']
      round: { type: String, enum: [...INTERVIEW_ROUNDS, null], default: null },
      durationMinutes: { type: Number, default: 30 },
      questionCount: { type: Number, default: 8 },
      // These were absent, so scheduleInterview's `bp.difficulty` was always
      // undefined and a job could never set its own difficulty or level.
      difficulty: { type: String, enum: [...DIFFICULTY, null], default: null },
      experienceLevel: { type: String, enum: [...EXPERIENCE_LEVELS, null], default: null },
      adaptiveDifficulty: { type: Boolean, default: true },
      followUps: { type: Boolean, default: true },
      useQuestionBank: { type: Boolean, default: true },
      language: { type: String, enum: ['en', 'hi'], default: 'en' },
      allowSkip: { type: Boolean, default: true },
      maxSkips: { type: Number, default: 2 },
      /** Default fixed question set for this role. */
      questionSet: { type: Schema.Types.ObjectId, ref: 'QuestionSet', default: null },
    },

    // Optional knowledge base that grounds AI interview questions for this role.
    knowledgeBase: { type: Schema.Types.ObjectId, ref: 'KnowledgeBase', default: null },

    status: { type: String, enum: JOB_STATUS, default: 'draft', index: true },
    openings: { type: Number, default: 1 },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

jobSchema.index({ company: 1, status: 1, createdAt: -1 });
jobSchema.index({ title: 'text', description: 'text' });

export const Job = mongoose.model('Job', jobSchema);
export default Job;
