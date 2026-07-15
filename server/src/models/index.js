// Barrel export for all Mongoose models.
export { User } from './User.js';
export { Company } from './Company.js';
export { Job } from './Job.js';
export { Candidate } from './Candidate.js';
export { Interview } from './Interview.js';
export { Question } from './Question.js';
export { Answer } from './Answer.js';
export { Report } from './Report.js';
export { Subscription } from './Subscription.js';
export { Plan } from './Plan.js';
export { Coupon } from './Coupon.js';
export { Payment } from './Payment.js';
export { Notification } from './Notification.js';
export { ActivityLog } from './ActivityLog.js';
export { AuditLog } from './AuditLog.js';
export { SystemSetting } from './SystemSetting.js';
export { AiUsage } from './AiUsage.js';
export { Page } from './Page.js';
export { BlogPost } from './BlogPost.js';
export { Faq } from './Faq.js';
export { Testimonial } from './Testimonial.js';
export { Announcement } from './Announcement.js';
export { Template } from './Template.js';
export { Branding } from './Branding.js';
export { AiProvider } from './AiProvider.js';
export { Lead } from './Lead.js';
export { ApiKey } from './ApiKey.js';

/**
 * These nine had drifted out of the barrel — they were reached only by direct
 * import, so `mongoose.models` was missing a quarter of the schema.
 *
 * That is fine for a controller importing what it needs, and not fine for
 * anything that walks the registry. scripts/sync-indexes.js does exactly that,
 * and in production (autoIndex is off there) it is the ONLY thing that builds an
 * index — so a model absent here silently never gets one. Application's whole
 * "one live application per person" guarantee is a partial unique index.
 *
 * Anything with a schema belongs here, whether or not something imports it today.
 */
export { Application } from './Application.js';
export { QuestionSet } from './QuestionSet.js';
export { KnowledgeBase } from './KnowledgeBase.js';
export { Role } from './Role.js';
export { EmailLog } from './EmailLog.js';
export { PromptTemplate } from './PromptTemplate.js';
export { DemoBooking } from './DemoBooking.js';
export { AnalyticsEvent } from './AnalyticsEvent.js';
export { PageView } from './PageView.js';
