import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Global white-label branding. A single document drives the platform's identity,
 * theme, footer, social links, announcement bar, login page, and SEO — all
 * editable by the super-admin with no code changes. (Per-company overrides can
 * extend this later via an optional `company` field.)
 */
const brandingSchema = new Schema(
  {
    // null = global/platform branding; set = company override (future use).
    company: { type: Schema.Types.ObjectId, ref: 'Company', default: null, unique: true, sparse: true },

    platformName: { type: String, default: 'HireSense' },
    tagline: { type: String, default: 'AI-Powered Interview Platform' },
    logoUrl: { type: String },
    logoDarkUrl: { type: String },
    faviconUrl: { type: String },
    footerText: { type: String, default: '© {year} HireSense. All rights reserved.' },

    theme: {
      primary: { type: String, default: '#7c5cff' }, // hex
      accent: { type: String, default: '#22d3ee' },
      font: { type: String, default: 'Sora' }, // display font name
      defaultMode: { type: String, enum: ['dark', 'light'], default: 'dark' },
    },

    login: {
      headline: { type: String, default: 'Welcome back' },
      subtext: { type: String, default: 'Sign in to your account' },
      imageUrl: { type: String },
    },

    social: {
      facebook: String,
      instagram: String,
      linkedin: String,
      x: String,
      youtube: String,
      whatsapp: String,
      telegram: String,
    },

    contact: {
      email: String,
      phone: String,
      address: String,
    },

    announcement: {
      enabled: { type: Boolean, default: false },
      text: { type: String, default: '' },
      type: { type: String, enum: ['info', 'success', 'warning'], default: 'info' },
      link: { type: String },
    },

    seo: {
      title: String,
      description: String,
      keywords: [String],
      ogImage: String,
    },

    customCss: { type: String, default: '' },

    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

/** Returns the global branding doc, creating defaults on first access. */
brandingSchema.statics.getGlobal = async function getGlobal() {
  let doc = await this.findOne({ company: null });
  if (!doc) doc = await this.create({ company: null });
  return doc;
};

export const Branding = mongoose.model('Branding', brandingSchema);
export default Branding;
