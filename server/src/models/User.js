import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import { ROLE_VALUES, ROLES } from '../constants/enums.js';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true },
    // Not selected by default — must explicitly .select('+password')
    password: { type: String, select: false, minlength: 8 },

    role: { type: String, enum: ROLE_VALUES, default: ROLES.CANDIDATE, index: true },

    // Tenancy: null for super_admin and (some) candidates; set for company staff.
    company: { type: Schema.Types.ObjectId, ref: 'Company', index: true },

    avatar: { type: String },
    isActive: { type: Boolean, default: true },

    // Verification & security
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, select: false },
    },

    // OAuth identities
    providers: {
      google: { id: String },
      linkedin: { id: String },
    },

    lastLoginAt: { type: Date },
    // Bump to invalidate all previously issued refresh tokens for this user.
    tokenVersion: { type: Number, default: 0 },

    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

userSchema.index({ company: 1, role: 1 });

// Hash password on create/update when modified.
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, config.bcryptRounds);
  next();
});

/** @param {string} candidate plaintext password */
userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.password;
  if (obj.twoFactor) delete obj.twoFactor.secret;
  return obj;
};

export const User = mongoose.model('User', userSchema);
export default User;
