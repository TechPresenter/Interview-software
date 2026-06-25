import mongoose from 'mongoose';

const { Schema } = mongoose;

const blogPostSchema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    excerpt: { type: String },
    content: { type: String, default: '' },
    coverImage: { type: String },
    tags: [String],
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    publishedAt: { type: Date },
    views: { type: Number, default: 0 },
    seo: { title: String, description: String },
  },
  { timestamps: true },
);

blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ title: 'text', excerpt: 'text', tags: 'text' });

export const BlogPost = mongoose.model('BlogPost', blogPostSchema);
export default BlogPost;
