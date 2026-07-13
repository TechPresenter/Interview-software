import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Discount coupon / promo code managed by the super-admin. */
const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    description: String,

    type: { type: String, enum: ['percent', 'amount'], required: true },
    value: { type: Number, required: true }, // percent (0-100) or minor units (paise)
    currency: { type: String, default: 'INR' },

    // Restrictions
    appliesToPlans: [String], // empty => all plans
    maxRedemptions: { type: Number }, // null => unlimited
    redemptions: { type: Number, default: 0 },
    perCustomerLimit: { type: Number, default: 1 },

    validFrom: { type: Date, default: Date.now },
    validUntil: { type: Date },
    isActive: { type: Boolean, default: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

/** Whether the coupon can currently be redeemed. */
couponSchema.methods.isRedeemable = function isRedeemable() {
  const now = Date.now();
  if (!this.isActive) return false;
  if (this.validFrom && this.validFrom.getTime() > now) return false;
  if (this.validUntil && this.validUntil.getTime() < now) return false;
  if (this.maxRedemptions != null && this.redemptions >= this.maxRedemptions) return false;
  return true;
};

export const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;
