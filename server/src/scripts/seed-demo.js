/**
 * Demo data: one account per role (all password Demo@12345) + a company with a
 * job, candidates, and a scheduled interview so every panel has something to show.
 *   npm run seed:demo
 */
import { connectDB, disconnectDB } from '../config/db.js';
import { logger } from '../config/logger.js';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { Job } from '../models/Job.js';
import { Candidate } from '../models/Candidate.js';
import { Interview } from '../models/Interview.js';
import { Subscription } from '../models/Subscription.js';
import { Plan } from '../models/Plan.js';
import { ROLES, PLANS } from '../constants/enums.js';
import { slugify } from '../utils/slug.js';

const PW = 'Demo@12345';

async function upsertUser({ name, email, role, company }) {
  let u = await User.findOne({ email });
  if (!u) u = new User({ name, email, role });
  u.name = name;
  u.role = role;
  u.company = company;
  u.isActive = true;
  u.isEmailVerified = true;
  u.password = PW; // re-hashed by the pre-save hook
  await u.save();
  return u;
}

async function run() {
  await connectDB();

  // Plan (for limits snapshot)
  let plan = await Plan.findOne({ key: PLANS.PROFESSIONAL });
  if (!plan) {
    if ((await Plan.countDocuments()) === 0) await Plan.insertMany(Plan.defaults());
    plan = await Plan.findOne({ key: PLANS.PROFESSIONAL });
  }

  // Company
  let company = await Company.findOne({ name: 'Demo Company' });
  if (!company) {
    company = await Company.create({ name: 'Demo Company', slug: slugify('Demo Company'), plan: PLANS.PROFESSIONAL, limits: plan?.limits });
  }
  await Subscription.findOneAndUpdate(
    { company: company._id },
    { $set: { company: company._id, plan: PLANS.PROFESSIONAL, status: 'active', provider: 'manual' } },
    { upsert: true },
  );

  // One account per role
  const admin = await upsertUser({ name: 'Company Admin', email: 'company@hiresense.ai', role: ROLES.COMPANY_ADMIN, company: company._id });
  await upsertUser({ name: 'Riya Recruiter', email: 'recruiter@hiresense.ai', role: ROLES.RECRUITER, company: company._id });
  await upsertUser({ name: 'Hari HR', email: 'hr@hiresense.ai', role: ROLES.HR_MANAGER, company: company._id });
  await upsertUser({ name: 'Cara Candidate', email: 'candidate@hiresense.ai', role: ROLES.CANDIDATE, company: undefined });
  company.owner = admin._id;
  await company.save();
  logger.info('✅ Role accounts ready (company/recruiter/hr/candidate @hiresense.ai)');

  // A job
  let job = await Job.findOne({ company: company._id, title: 'Senior Frontend Engineer' });
  if (!job) {
    job = await Job.create({
      company: company._id,
      title: 'Senior Frontend Engineer',
      slug: slugify('Senior Frontend Engineer'),
      department: 'Engineering',
      location: 'Remote',
      status: 'open',
      description: 'Build delightful, performant UIs with React/Next.js.',
      skills: [{ name: 'react' }, { name: 'typescript' }, { name: 'system-design' }],
      interviewConfig: { types: ['technical', 'behavioral'], durationMinutes: 30, questionCount: 6 },
      createdBy: admin._id,
    });
  }

  // Candidates (linked to the demo candidate email so the portal shows them)
  const candidateSeed = [
    { name: 'Cara Candidate', email: 'candidate@hiresense.ai', stage: 'interview' },
    { name: 'Liam Patel', email: 'liam@example.com', stage: 'screening' },
    { name: 'Noah Kim', email: 'noah@example.com', stage: 'applied' },
  ];
  for (const c of candidateSeed) {
    await Candidate.findOneAndUpdate(
      { company: company._id, email: c.email, job: job._id },
      { $set: { company: company._id, job: job._id, name: c.name, email: c.email, stage: c.stage, addedBy: admin._id, skills: ['react', 'typescript'] } },
      { upsert: true },
    );
  }

  // A scheduled interview for the demo candidate (gives the interview room a link)
  const cara = await Candidate.findOne({ company: company._id, email: 'candidate@hiresense.ai' });
  const existing = await Interview.findOne({ candidate: cara._id, status: 'scheduled' });
  if (!existing && cara) {
    const iv = await Interview.create({
      company: company._id,
      job: job._id,
      candidate: cara._id,
      types: ['technical', 'behavioral'],
      config: { durationMinutes: 30, questionCount: 6 },
      expiresAt: new Date(Date.now() + 14 * 864e5),
      invitedBy: admin._id,
    });
    logger.info(`✅ Demo interview link: /interview/${iv.accessToken}`);
  }

  logger.info('🎉 Demo seed complete');
  await disconnectDB();
  process.exit(0);
}

run().catch((err) => {
  logger.error({ err }, 'demo seed failed');
  process.exit(1);
});
