import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Reusable email / notification templates with {{handlebars-style}} variables.
 * Rendered by services/template.service.js.
 */
const templateSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true }, // e.g. 'interview_invite'
    name: { type: String, required: true },
    channel: { type: String, enum: ['email', 'sms', 'whatsapp', 'in_app'], default: 'email' },
    subject: { type: String }, // email only
    body: { type: String, required: true },
    variables: [String], // documented placeholders
    isActive: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Template = mongoose.model('Template', templateSchema);
export default Template;
