import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * One row per payment-gateway webhook delivery, whatever became of it.
 *
 * This exists because the activation bug class is invisible without it: a
 * webhook that verifies, parses, and then throws inside activation returns a
 * 500 to the gateway and leaves nothing queryable behind — the company stays
 * on the free plan and the only evidence is a pino line that scrolled away.
 * Payment.raw only captures SUCCESSFUL payments; this captures every delivery,
 * including the ones that failed to become payments.
 */
const webhookLogSchema = new Schema(
  {
    provider: { type: String, required: true, index: true }, // stripe | razorpay | cashfree
    /** The gateway's own event name (e.g. PAYMENT_SUCCESS_WEBHOOK). */
    event: String,
    /** What our parser made of it (payment_succeeded | …) — empty if ignored. */
    kind: String,
    orderId: { type: String, index: true },
    paymentId: String,
    signatureValid: { type: Boolean, default: false },
    outcome: {
      type: String,
      enum: ['processed', 'duplicate', 'ignored', 'invalid_signature', 'error'],
      required: true,
      index: true,
    },
    error: String, // the throw that stopped activation, verbatim
    company: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    application: { type: Schema.Types.ObjectId, ref: 'Application' },
    /** Full payload for replay/debugging. select:false — it is large and raw. */
    payload: { type: Schema.Types.Mixed, select: false },
  },
  { timestamps: true },
);

// Debugging data, not accounting data: keep six months, then let it go.
webhookLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });
webhookLogSchema.index({ provider: 1, outcome: 1, createdAt: -1 });

export const WebhookLog = mongoose.model('WebhookLog', webhookLogSchema);
export default WebhookLog;
