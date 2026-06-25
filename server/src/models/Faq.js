import mongoose from 'mongoose';

const { Schema } = mongoose;

const faqSchema = new Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, default: 'general' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

faqSchema.index({ category: 1, order: 1 });

export const Faq = mongoose.model('Faq', faqSchema);
export default Faq;
