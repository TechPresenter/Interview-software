import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A custom staff role scoped to a company. Permissions are a { module: {create,
 * read, update, delete} } map validated against constants/permissions.js. System
 * roles (isSystem) are seeded templates that can be cloned but not deleted.
 */
const roleSchema = new Schema(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', index: true, required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 240 },
    permissions: { type: Schema.Types.Mixed, default: {} },
    isSystem: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

roleSchema.index({ company: 1, name: 1 }, { unique: true });

export const Role = mongoose.model('Role', roleSchema);
export default Role;
