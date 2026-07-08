import { Company } from '../../models/Company.js';
import { User } from '../../models/User.js';
import { Job } from '../../models/Job.js';
import { Candidate } from '../../models/Candidate.js';
import { Interview } from '../../models/Interview.js';
import { Report } from '../../models/Report.js';
import { Question } from '../../models/Question.js';
import { KnowledgeBase } from '../../models/KnowledgeBase.js';
import { Role } from '../../models/Role.js';
import { Subscription } from '../../models/Subscription.js';
import { Payment } from '../../models/Payment.js';
import { ApiKey } from '../../models/ApiKey.js';
import { AiProvider } from '../../models/AiProvider.js';
import { Notification } from '../../models/Notification.js';
import { EmailLog } from '../../models/EmailLog.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { audit } from '../../services/audit.service.js';

/**
 * DELETE /company/account — permanently delete a company workspace.
 *
 * Only the workspace owner may do this. Requires the exact company name as
 * confirmation. Cascades to all company-owned data; staff accounts are either
 * deleted or deactivated per `staffAction`. The owner's own session is
 * invalidated as part of the deletion, so the client is logged out afterwards.
 */
export const deleteAccount = asyncHandler(async (req, res) => {
  const cid = req.companyId;
  const { confirm, staffAction = 'delete' } = req.body || {};

  const company = await Company.findById(cid);
  if (!company) throw ApiError.notFound('Company not found');
  if (String(company.owner) !== String(req.user._id)) {
    throw ApiError.forbidden('Only the workspace owner can delete the account');
  }
  if (!confirm || String(confirm).trim().toLowerCase() !== company.name.trim().toLowerCase()) {
    throw ApiError.badRequest('Please type the exact company name to confirm deletion');
  }

  // Cascade-delete all company-owned data.
  await Promise.all([
    Job.deleteMany({ company: cid }),
    Candidate.deleteMany({ company: cid }),
    Interview.deleteMany({ company: cid }),
    Report.deleteMany({ company: cid }),
    Question.deleteMany({ company: cid }),
    KnowledgeBase.deleteMany({ company: cid }),
    Role.deleteMany({ company: cid }),
    Subscription.deleteMany({ company: cid }),
    Payment.deleteMany({ company: cid }),
    ApiKey.deleteMany({ company: cid }),
    AiProvider.deleteMany({ company: cid }),
    Notification.deleteMany({ company: cid }),
    EmailLog.deleteMany({ company: cid }),
  ]);

  // Staff: delete their accounts, or deactivate (kept for records, can't sign in).
  if (staffAction === 'deactivate') {
    await User.updateMany({ company: cid }, { $set: { isActive: false }, $inc: { tokenVersion: 1 } });
  } else {
    await User.deleteMany({ company: cid });
  }

  await Company.findByIdAndDelete(cid);
  await audit({ req, action: 'company.account.deleted', entityType: 'Company', entityId: cid, meta: { staffAction, name: company.name } });
  return ok(res, { deleted: true }, 'Your account and all associated data have been deleted.');
});
