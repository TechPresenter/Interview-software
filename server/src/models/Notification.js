import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '../constants/enums.js';

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    company: { type: Schema.Types.ObjectId, ref: 'Company', index: true },

    type: { type: String, enum: NOTIFICATION_TYPES, default: 'system' },
    title: { type: String, required: true },
    body: { type: String },
    link: { type: String }, // deep link in the app

    channels: [{ type: String, enum: ['in_app', 'email', 'sms', 'whatsapp'] }],
    isRead: { type: Boolean, default: false, index: true },
    readAt: Date,

    data: Schema.Types.Mixed,
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
