import { parse } from 'csv-parse/sync';
import { Candidate } from '../../models/Candidate.js';
import { Job } from '../../models/Job.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { Company } from '../../models/Company.js';
import { saveBuffer, extractText } from '../../services/file.service.js';
import { analyzeResume, parsedToCandidate } from '../../services/ai/resume.analyzer.js';
import { logActivity } from '../../services/audit.service.js';
import { safeSendTemplated } from '../../services/email.service.js';
import { config } from '../../config/index.js';

const scope = (req, extra = {}) => ({ company: req.companyId, ...extra });

/** GET /company/candidates */
export const list = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { searchFields: ['name', 'email', 'skills'] });
  const filter = scope(req, opts.filter);
  if (req.query.stage) filter.stage = req.query.stage;
  if (req.query.job) filter.job = req.query.job;
  const { items, meta } = await paginateQuery(Candidate, filter, opts, { path: 'job', select: 'title' });
  return ok(res, items, 'OK', meta);
});

/** GET /company/candidates/:id */
export const getOne = asyncHandler(async (req, res) => {
  const candidate = await Candidate.findOne(scope(req, { _id: req.params.id }))
    .populate('job', 'title skills')
    .lean();
  if (!candidate) throw ApiError.notFound('Candidate not found');
  return ok(res, candidate);
});

/** POST /company/candidates */
export const create = asyncHandler(async (req, res) => {
  const candidate = await Candidate.create({
    ...req.body,
    company: req.companyId,
    addedBy: req.user._id,
  });
  await logActivity({
    company: req.companyId,
    actor: req.user._id,
    action: 'candidate.added',
    entityType: 'Candidate',
    entityId: candidate._id,
    summary: `Candidate ${candidate.name} added`,
  });

  // Optional "application received" email (only when the recruiter opts in).
  if (req.body.notifyCandidate && candidate.email) {
    const [job, company] = await Promise.all([
      candidate.job ? Job.findById(candidate.job).select('title').lean() : null,
      Company.findById(req.companyId).select('name').lean(),
    ]);
    await safeSendTemplated('application_confirmation', {
      to: candidate.email,
      vars: { name: candidate.name, jobTitle: job?.title || 'the role', company: company?.name || 'the company' },
      company: req.companyId,
      relatedUser: candidate.user,
    });
  }

  return created(res, candidate, 'Candidate added');
});

/** PATCH /company/candidates/:id */
export const update = asyncHandler(async (req, res) => {
  const candidate = await Candidate.findOneAndUpdate(scope(req, { _id: req.params.id }), { $set: req.body }, { new: true });
  if (!candidate) throw ApiError.notFound('Candidate not found');
  return ok(res, candidate, 'Candidate updated');
});

/** DELETE /company/candidates/:id */
export const remove = asyncHandler(async (req, res) => {
  const candidate = await Candidate.findOneAndDelete(scope(req, { _id: req.params.id }));
  if (!candidate) throw ApiError.notFound('Candidate not found');
  return ok(res, null, 'Candidate deleted');
});

/** POST /company/candidates/:id/notes */
export const addNote = asyncHandler(async (req, res) => {
  const candidate = await Candidate.findOneAndUpdate(
    scope(req, { _id: req.params.id }),
    { $push: { notes: { author: req.user._id, body: req.body.body } } },
    { new: true },
  );
  if (!candidate) throw ApiError.notFound('Candidate not found');
  return ok(res, candidate.notes, 'Note added');
});

/**
 * POST /company/candidates/import — CSV with columns:
 * name,email,phone,location,skills (skills semicolon- or comma-separated).
 * Optional ?job= to assign all rows to a job.
 */
export const importCsv = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('CSV file is required (field "file")');
  let records;
  try {
    records = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
  } catch {
    throw ApiError.badRequest('Could not parse CSV');
  }

  const job = req.query.job || undefined;
  const docs = [];
  const errors = [];
  records.forEach((row, i) => {
    const name = row.name || row.Name;
    const email = (row.email || row.Email || '').toLowerCase();
    if (!name || !email) {
      errors.push({ row: i + 2, error: 'Missing name or email' });
      return;
    }
    docs.push({
      company: req.companyId,
      addedBy: req.user._id,
      job,
      source: 'csv',
      name,
      email,
      phone: row.phone || row.Phone,
      location: row.location || row.Location,
      skills: (row.skills || row.Skills || '')
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    });
  });

  // insertMany with ordered:false so duplicates don't abort the whole import.
  let inserted = 0;
  try {
    const result = await Candidate.insertMany(docs, { ordered: false });
    inserted = result.length;
  } catch (err) {
    inserted = err?.result?.insertedCount ?? err?.insertedDocs?.length ?? 0;
  }

  await logActivity({ company: req.companyId, actor: req.user._id, action: 'candidate.imported', summary: `Imported ${inserted} candidates` });
  return created(res, { inserted, skipped: docs.length - inserted, parseErrors: errors }, 'Import complete');
});

/**
 * POST /company/candidates/:id/resume — upload, store, extract text, and run the
 * AI resume analyzer against the candidate's job.
 */
export const uploadResumeFile = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Resume file is required (field "resume")');
  const candidate = await Candidate.findOne(scope(req, { _id: req.params.id })).populate('job', 'title skills');
  if (!candidate) throw ApiError.notFound('Candidate not found');

  const [{ url, filename }, text] = await Promise.all([
    saveBuffer(req.file.buffer, req.file.originalname),
    extractText(req.file.buffer, req.file.mimetype, req.file.originalname),
  ]);

  candidate.resume = { url, filename, text, uploadedAt: new Date() };

  // Best-effort AI analysis + profile extraction (don't fail the upload if AI is down).
  let analysis = null;
  let parsed = null;
  if (config.ai.enabled && text) {
    try {
      analysis = await analyzeResume({
        resumeText: text,
        jobTitle: candidate.job?.title,
        requiredSkills: (candidate.job?.skills || []).map((s) => s.name),
        company: req.companyId,
      });
      candidate.resumeAnalysis = analysis;
      // Auto-fill EMPTY candidate fields from the parsed resume (never overwrite
      // data a recruiter already entered). Skills always merge.
      parsed = parsedToCandidate(analysis);
      for (const [k, v] of Object.entries(parsed)) {
        if (k === 'skills') {
          candidate.skills = Array.from(new Set([...(candidate.skills || []), ...v]));
        } else if (isEmptyField(candidate[k])) {
          candidate[k] = v;
        }
      }
    } catch {
      /* analysis is optional */
    }
  }
  await candidate.save();

  return ok(res, { resume: candidate.resume, analysis, parsed }, 'Resume uploaded');
});

const isEmptyField = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * POST /company/candidates/parse-resume — upload + AI-parse a resume WITHOUT
 * creating a candidate. Returns the stored file + extracted fields so the "Add
 * candidate" form can be pre-filled for the recruiter to review/edit before save.
 * The original file is preserved and its URL returned to attach on save.
 */
export const parseResume = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Resume file is required (field "resume")');

  const [{ url, filename }, text] = await Promise.all([
    saveBuffer(req.file.buffer, req.file.originalname),
    extractText(req.file.buffer, req.file.mimetype, req.file.originalname),
  ]);
  if (!text || text.trim().length < 30) {
    return ok(res, { resume: { url, filename }, fields: {}, analysis: null, warning: 'Could not read enough text from this file to auto-fill.' }, 'Resume stored');
  }

  let analysis = null;
  let fields = {};
  if (config.ai.enabled) {
    try {
      const job = req.query.job ? await Job.findOne(scope(req, { _id: req.query.job })).select('title skills').lean() : null;
      analysis = await analyzeResume({
        resumeText: text,
        jobTitle: job?.title,
        requiredSkills: (job?.skills || []).map((s) => s.name),
        company: req.companyId,
      });
      fields = parsedToCandidate(analysis);
    } catch {
      /* parsing optional — the file is still stored */
    }
  }
  return ok(res, { resume: { url, filename, text, uploadedAt: new Date() }, fields, analysis }, 'Resume parsed');
});

/** GET /company/candidates/:id/resume-analysis — re-run analysis on stored text. */
export const reanalyzeResume = asyncHandler(async (req, res) => {
  const candidate = await Candidate.findOne(scope(req, { _id: req.params.id })).populate('job', 'title skills');
  if (!candidate) throw ApiError.notFound('Candidate not found');
  if (!candidate.resume?.text) throw ApiError.badRequest('No resume on file to analyze');

  const analysis = await analyzeResume({
    resumeText: candidate.resume.text,
    jobTitle: candidate.job?.title,
    requiredSkills: (candidate.job?.skills || []).map((s) => s.name),
    company: req.companyId,
  });
  candidate.resumeAnalysis = analysis;
  await candidate.save();
  return ok(res, analysis, 'Resume analyzed');
});
