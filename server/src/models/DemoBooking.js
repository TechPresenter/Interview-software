import mongoose from 'mongoose';

const { Schema } = mongoose;

export const DEMO_STATUSES = ['pending', 'confirmed', 'rescheduled', 'completed', 'cancelled'];

/**
 * A "Book a Demo" request from the public marketing site. Managed by the
 * super-admin under Enquiries → Demo Bookings (assign, reschedule, notes, status).
 */
const demoBookingSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true },
    country: { type: String, trim: true },

    preferredDate: { type: Date },
    timeSlot: { type: String, trim: true }, // e.g. "10:00 AM – 11:00 AM"
    timezone: { type: String, trim: true },
    employees: { type: String, trim: true }, // range e.g. "51-200"
    message: { type: String, trim: true, maxlength: 4000 },

    status: { type: String, enum: DEMO_STATUSES, default: 'pending', index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, default: '' }, // internal notes

    // Chronological activity/audit trail for the booking.
    activity: [
      {
        _id: false,
        action: String, // created | status | assigned | rescheduled | note
        detail: String,
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
      },
    ],

    source: { type: String, default: 'website' },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

demoBookingSchema.index({ createdAt: -1 });
demoBookingSchema.index({ status: 1, preferredDate: 1 });

export const DemoBooking = mongoose.model('DemoBooking', demoBookingSchema);
export default DemoBooking;
