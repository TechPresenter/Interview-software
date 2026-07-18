import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Singleton-style key/value store for platform configuration editable by the
 * super-admin: SMTP, SMS gateway, payment gateways, AI prompt templates &
 * weightage, security toggles, feature flags. Secret values should be encrypted
 * at the service layer before saving.
 */
const systemSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    group: {
      type: String,
      // Every group actually written anywhere. This list had drifted — 'voice',
      // 'proctoring', 'captcha', 'applications' and 'jobs' were being written for
      // months and only survived because setMany uses bulkWrite, which skips
      // mongoose validation. Keep it complete or the next .save()/create() on a
      // settings doc starts throwing for a group that "always worked".
      enum: ['smtp', 'sms', 'payment', 'ai', 'security', 'general', 'feature_flag', 'integrations', 'voice', 'proctoring', 'captcha', 'applications', 'jobs', 'billing'],
      default: 'general',
      index: true,
    },
    value: { type: Schema.Types.Mixed },
    isSecret: { type: Boolean, default: false },
    description: String,
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);
export default SystemSetting;
