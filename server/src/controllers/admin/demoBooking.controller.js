import { DemoBooking, DEMO_STATUSES } from '../../models/DemoBooking.js';
import { User } from '../../models/User.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { parseListQuery, paginateQuery } from '../../utils/query.js';
import { audit } from '../../services/audit.service.js';

/** GET /admin/demo-bookings — list with search + filters. */
export const list = asyncHandler(async (req, res) => {
  const opts = parseListQuery(req.query, { searchFields: ['name', 'email', 'company', 'phone'], defaultSort: '-createdAt' });
  if (req.query.status) opts.filter.status = req.query.status;
  if (req.query.assignedTo) opts.filter.assignedTo = req.query.assignedTo;
  const { items, meta } = await paginateQuery(DemoBooking, opts.filter, opts, { path: 'assignedTo', select: 'name email' });
  return ok(res, items, 'OK', meta);
});

/** GET /admin/demo-bookings/stats — counts by status. */
export const stats = asyncHandler(async (_req, res) => {
  const agg = await DemoBooking.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  const byStatus = Object.fromEntries(DEMO_STATUSES.map((s) => [s, 0]));
  let total = 0;
  for (const r of agg) { if (r._id) byStatus[r._id] = r.n; total += r.n; }
  return ok(res, { total, byStatus, pending: byStatus.pending });
});

/** GET /admin/demo-bookings/:id — full detail + activity + assignable team. */
export const detail = asyncHandler(async (req, res) => {
  const booking = await DemoBooking.findById(req.params.id).populate('assignedTo', 'name email').populate('activity.by', 'name').lean();
  if (!booking) throw ApiError.notFound('Demo booking not found');
  return ok(res, booking);
});

/** GET /admin/demo-bookings/assignees — staff who can own a booking. */
export const assignees = asyncHandler(async (_req, res) => {
  const users = await User.find({ role: { $in: ['super_admin', 'company_admin', 'recruiter', 'hr_manager'] }, isActive: true })
    .select('name email role').limit(200).lean();
  return ok(res, users);
});

/**
 * PATCH /admin/demo-bookings/:id — update status / assignee / notes / schedule.
 * Every change appends an activity entry (booking history).
 */
export const update = asyncHandler(async (req, res) => {
  const booking = await DemoBooking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Demo booking not found');

  const { status, assignedTo, notes, preferredDate, timeSlot, timezone } = req.body;
  const events = [];

  if (status && status !== booking.status) {
    if (!DEMO_STATUSES.includes(status)) throw ApiError.badRequest('Invalid status');
    events.push({ action: 'status', detail: `${booking.status} → ${status}` });
    booking.status = status;
  }
  if (assignedTo !== undefined && String(assignedTo || '') !== String(booking.assignedTo || '')) {
    booking.assignedTo = assignedTo || null;
    let who = 'unassigned';
    if (assignedTo) { const u = await User.findById(assignedTo).select('name').lean(); who = u?.name || 'a team member'; }
    events.push({ action: 'assigned', detail: `Assigned to ${who}` });
  }
  if (typeof notes === 'string' && notes !== booking.notes) {
    booking.notes = notes;
    events.push({ action: 'note', detail: 'Internal notes updated' });
  }
  // Reschedule — only when the date/time actually changed (the admin UI resends
  // the current values on every save, so we compare before logging/flipping).
  const ts = (d) => (d ? new Date(d).getTime() : 0);
  let rescheduled = false;
  if (preferredDate !== undefined && ts(preferredDate) !== ts(booking.preferredDate)) {
    booking.preferredDate = preferredDate ? new Date(preferredDate) : null;
    rescheduled = true;
  }
  if (timeSlot !== undefined && timeSlot !== (booking.timeSlot || '')) { booking.timeSlot = timeSlot; rescheduled = true; }
  if (timezone !== undefined && timezone !== (booking.timezone || '')) booking.timezone = timezone;
  if (rescheduled) {
    events.push({ action: 'rescheduled', detail: `Rescheduled to ${booking.preferredDate ? new Date(booking.preferredDate).toDateString() : 'TBD'} ${booking.timeSlot || ''}`.trim() });
    // Auto-flag as rescheduled only when the admin didn't explicitly set a status.
    if (!status && (booking.status === 'pending' || booking.status === 'confirmed')) booking.status = 'rescheduled';
  }

  for (const e of events) booking.activity.push({ ...e, by: req.user._id, at: new Date() });
  await booking.save();
  await audit({ req, action: 'demo.update', entityType: 'DemoBooking', entityId: booking._id, meta: { status: booking.status } });

  const populated = await booking.populate('assignedTo', 'name email');
  return ok(res, populated, 'Booking updated');
});

/** DELETE /admin/demo-bookings/:id */
export const remove = asyncHandler(async (req, res) => {
  const booking = await DemoBooking.findByIdAndDelete(req.params.id);
  if (!booking) throw ApiError.notFound('Demo booking not found');
  await audit({ req, action: 'demo.delete', entityType: 'DemoBooking', entityId: req.params.id });
  return ok(res, null, 'Deleted');
});

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** GET /admin/demo-bookings/export — CSV of demo bookings. */
export const exportCsv = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const rows = await DemoBooking.find(filter).sort('-createdAt').limit(20000).populate('assignedTo', 'name').lean();
  const cols = [
    ['Name', (r) => r.name], ['Company', (r) => r.company], ['Email', (r) => r.email], ['Phone', (r) => r.phone],
    ['Country', (r) => r.country], ['Preferred date', (r) => (r.preferredDate ? new Date(r.preferredDate).toISOString().slice(0, 10) : '')],
    ['Time slot', (r) => r.timeSlot], ['Timezone', (r) => r.timezone], ['Employees', (r) => r.employees],
    ['Status', (r) => r.status], ['Assigned to', (r) => r.assignedTo?.name], ['Requested', (r) => new Date(r.createdAt).toISOString()],
  ];
  const header = cols.map(([h]) => csvCell(h)).join(',');
  const body = rows.map((r) => cols.map(([, get]) => csvCell(get(r))).join(',')).join('\n');
  await audit({ req, action: 'demo.export', entityType: 'DemoBooking', meta: { count: rows.length } });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="demo-bookings-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(`\uFEFF${header}\n${body}`);
});
