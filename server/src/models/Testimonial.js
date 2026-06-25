import mongoose from 'mongoose';

const { Schema } = mongoose;

const testimonialSchema = new Schema(
  {
    name: { type: String, required: true },
    role: { type: String },
    company: { type: String },
    avatar: { type: String },
    quote: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Testimonial = mongoose.model('Testimonial', testimonialSchema);
export default Testimonial;
