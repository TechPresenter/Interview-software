import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Static marketing/legal pages (about, terms, privacy, …). */
const pageSchema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    content: { type: String, default: '' }, // markdown / HTML
    seo: { title: String, description: String, keywords: [String] },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Page = mongoose.model('Page', pageSchema);
export default Page;
