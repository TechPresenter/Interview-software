import mongoose from 'mongoose';
import { PIPELINE_STAGES } from '../constants/enums.js';

const { Schema } = mongoose;

/**
 * A Candidate represents a person within a company's hiring pipeline. A single
 * human may have a global `User` login (candidate role) AND multiple Candidate
 * records across companies/jobs.
 */
const candidateSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User' }, // optional linked login
    job: { type: Schema.Types.ObjectId, ref: 'Job', index: true },

    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String },
    whatsapp: { type: String },
    location: { type: String },

    // Personal details.
    photo: { type: String }, // uploaded profile photo URL
    dob: { type: String }, // stored ISO or DD/MM/YYYY (free-form to match resumes)
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say', ''], default: '' },
    nationality: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    postalCode: { type: String },
    linkedin: { type: String },
    website: { type: String }, // portfolio / personal site
    languages: [String],

    // Professional details.
    currentCompany: { type: String },
    currentDesignation: { type: String },
    totalExperienceYears: { type: Number },
    currentSalary: { type: String },
    expectedSalary: { type: String },
    noticePeriod: { type: String },
    preferredLocation: { type: String },
    employmentType: { type: String }, // full_time | part_time | contract | internship | remote
    highestQualification: { type: String },

    education: [
      {
        degree: String,
        institution: String,
        field: String,
        startYear: Number,
        endYear: Number,
      },
    ],
    experience: [
      {
        title: String,
        company: String,
        startDate: Date,
        endDate: Date,
        current: { type: Boolean, default: false },
        description: String,
      },
    ],
    certifications: [{ name: String, issuer: String, year: String }],
    projects: [{ name: String, description: String, url: String }],
    skills: [String],
    portfolioLinks: [{ label: String, url: String }],

    resume: {
      url: String,
      filename: String,
      text: String, // extracted plaintext for AI analysis
      uploadedAt: Date,
    },

    // Cached resume-analyzer output (see services/ai/resume.analyzer.js).
    resumeAnalysis: {
      atsScore: Number,
      jobMatch: Number,
      extractedSkills: [String],
      missingSkills: [String],
      summary: String,
      analyzedAt: Date,
    },

    stage: { type: String, enum: PIPELINE_STAGES, default: 'applied', index: true },
    source: { type: String, default: 'manual' }, // manual | csv | referral | portal

    tags: [String],
    notes: [
      {
        author: { type: Schema.Types.ObjectId, ref: 'User' },
        body: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

candidateSchema.index({ company: 1, job: 1, stage: 1 });
candidateSchema.index({ company: 1, email: 1, job: 1 }, { unique: true, sparse: true });

export const Candidate = mongoose.model('Candidate', candidateSchema);
export default Candidate;
