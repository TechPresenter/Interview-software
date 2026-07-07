import { Candidate } from '../../models/Candidate.js';
import { Job } from '../../models/Job.js';
import { Company } from '../../models/Company.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { config } from '../../config/index.js';
import { logActivity } from '../../services/audit.service.js';
import { safeSendTemplated } from '../../services/email.service.js';
import { emitToCompany } from '../../socket/emitters.js';
import { PIPELINE_STAGES } from '../../constants/enums.js';

// Candidate-facing email sent when a recruiter moves them into a decision stage.
const STAGE_EMAIL = { shortlisted: 'candidate_shortlisted', hired: 'candidate_selected', rejected: 'candidate_rejected' };

const scope = (req, extra = {}) => ({ company: req.companyId, ...extra });

/**
 * GET /company/pipeline?job= — candidates grouped into pipeline columns for a
 * kanban board.
 */
export const board = asyncHandler(async (req, res) => {
  const filter = scope(req);
  if (req.query.job) filter.job = req.query.job;

  const candidates = await Candidate.find(filter)
    .select('name email stage job resumeAnalysis updatedAt')
    .sort('-updatedAt')
    .lean();

  const columns = PIPELINE_STAGES.map((stage) => ({
    stage,
    candidates: candidates.filter((c) => c.stage === stage),
  }));
  return ok(res, { columns, total: candidates.length });
});

/** PATCH /company/candidates/:id/stage — move a candidate between stages. */
export const moveStage = asyncHandler(async (req, res) => {
  const { stage } = req.body;
  if (!PIPELINE_STAGES.includes(stage)) throw ApiError.badRequest('Invalid stage');

  const candidate = await Candidate.findOne(scope(req, { _id: req.params.id }));
  if (!candidate) throw ApiError.notFound('Candidate not found');

  const from = candidate.stage;
  candidate.stage = stage;
  await candidate.save();

  // Notify the candidate on decision-stage moves (best-effort, branded).
  const tplKey = STAGE_EMAIL[stage];
  if (tplKey && from !== stage && candidate.email) {
    const [job, company] = await Promise.all([
      candidate.job ? Job.findById(candidate.job).select('title').lean() : null,
      Company.findById(req.companyId).select('name').lean(),
    ]);
    await safeSendTemplated(tplKey, {
      to: candidate.email,
      vars: {
        name: candidate.name,
        jobTitle: job?.title || 'the role',
        company: company?.name || 'the company',
        link: config.clientUrl,
      },
      company: req.companyId,
      relatedUser: candidate.user,
    });
  }

  await logActivity({
    company: req.companyId,
    actor: req.user._id,
    action: 'pipeline.moved',
    entityType: 'Candidate',
    entityId: candidate._id,
    summary: `${candidate.name}: ${from} → ${stage}`,
  });
  emitToCompany(req.companyId, 'pipeline:moved', { id: candidate._id, from, to: stage });

  return ok(res, candidate, 'Stage updated');
});
