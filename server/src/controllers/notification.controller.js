import { Notification } from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/ApiResponse.js';

/** Role-agnostic notification feed for the logged-in user. */

/** GET /notifications */
export const list = asyncHandler(async (req, res) => {
  const items = await Notification.find({ recipient: req.user._id }).sort('-createdAt').limit(100).lean();
  const unread = items.filter((n) => !n.isRead).length;
  return ok(res, { items, unread });
});

/** PATCH /notifications/:id/read */
export const markRead = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, recipient: req.user._id }, { $set: { isRead: true } });
  return ok(res, null, 'Marked read');
});

/** POST /notifications/read-all */
export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, isRead: false }, { $set: { isRead: true } });
  return ok(res, null, 'All marked read');
});
