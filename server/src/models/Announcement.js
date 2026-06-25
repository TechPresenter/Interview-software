import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Platform/company announcements shown as banners or in the bell feed. */
const announcementSchema = new Schema(
  {
    title: { type: String, required: true },
    body: { type: String },
    type: { type: String, enum: ['info', 'success', 'warning', 'critical'], default: 'info' },
    // null audience => platform-wide; set => scoped to one company.
    company: { type: Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    audience: { type: String, enum: ['all', 'companies', 'candidates'], default: 'all' },
    isActive: { type: Boolean, default: true, index: true },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Announcement = mongoose.model('Announcement', announcementSchema);
export default Announcement;
