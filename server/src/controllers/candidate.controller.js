import { User } from '../models/User.js';
import { Candidate } from '../models/Candidate.js';
import { Interview } from '../models/Interview.js';
import { Notification } from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { saveBuffer, extractText } from '../services/file.service.js';
import { interviewLink } from '../services/interview.service.js';

/**
 * Candidate self-service portal. The candidate's profile lives on the User
 * document (`user.meta.profile`); their interviews are matched by email across
 * any company's Candidate records.
 */

/** GET /me/interviews — upcoming + completed interviews for this candidate. */
export const myInterviews = asyncHandler(async (req, res) => {
  const candidateRecords = await Candidate.find({ email: req.user.email }).select('_id').lean();
  const ids = candidateRecords.map((c) => c._id);

  const interviews = await Interview.find({ candidate: { $in: ids } })
    .populate('job', 'title')
    .sort('-createdAt')
    .lean();

  const shaped = interviews.map((i) => ({
    id: i._id,
    job: i.job?.title || 'the role',
    types: i.types,
    status: i.status,
    scheduledAt: i.scheduledAt,
    completedAt: i.completedAt,
    // Candidates get the link only while the interview is actionable.
    link: ['scheduled', 'in_progress'].includes(i.status) ? interviewLink(i) : null,
  }));

  return ok(res, {
    upcoming: shaped.filter((i) => ['scheduled', 'in_progress'].includes(i.status)),
    completed: shaped.filter((i) => ['completed', 'flagged'].includes(i.status)),
  });
});

/** GET /me/profile */
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).lean();
  return ok(res, { user, profile: user.meta?.profile || {} });
});

/** PUT /me/profile */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, avatar, profile } = req.body;
  const user = await User.findById(req.user._id);
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (avatar) user.avatar = avatar;
  if (profile) {
    user.meta = { ...(user.meta || {}), profile: { ...(user.meta?.profile || {}), ...profile } };
    user.markModified('meta');
  }
  await user.save();
  return ok(res, { user, profile: user.meta?.profile || {} }, 'Profile updated');
});

/** POST /me/resume — store + extract text into the profile. */
export const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Resume file required (field "resume")');
  const [{ url, filename }, text] = await Promise.all([
    saveBuffer(req.file.buffer, req.file.originalname),
    extractText(req.file.buffer, req.file.mimetype, req.file.originalname),
  ]);
  const user = await User.findById(req.user._id);
  user.meta = {
    ...(user.meta || {}),
    profile: { ...(user.meta?.profile || {}), resume: { url, filename, text, uploadedAt: new Date() } },
  };
  user.markModified('meta');
  await user.save();
  return ok(res, { resume: user.meta.profile.resume }, 'Resume uploaded');
});

/** GET /me/notifications */
export const notifications = asyncHandler(async (req, res) => {
  const items = await Notification.find({ recipient: req.user._id }).sort('-createdAt').limit(50).lean();
  const unread = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
  return ok(res, { items, unread });
});

/** PATCH /me/notifications/:id/read */
export const markRead = asyncHandler(async (req, res) => {
  await Notification.updateOne(
    { _id: req.params.id, recipient: req.user._id },
    { $set: { isRead: true, readAt: new Date() } },
  );
  return ok(res, null, 'Marked read');
});

/** POST /me/notifications/read-all */
export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
  return ok(res, null, 'All marked read');
});
