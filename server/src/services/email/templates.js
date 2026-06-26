import { button } from './layout.js';

/**
 * Built-in default email templates. Each can be overridden per-platform via the
 * Template collection (admin Email editor). Bodies are the inner content only —
 * the branded responsive shell (layout.js) wraps them. Placeholders use
 * {{handlebars}} and are interpolated by template.service.
 */

const h = (t) => `<h1 style="margin:0 0 14px;font-size:21px;font-weight:700;color:#ffffff;">${t}</h1>`;
const p = (t) => `<p style="margin:0 0 14px;">${t}</p>`;
const muted = (t) => `<p style="margin:14px 0 0;font-size:13px;color:#8b8b9a;">${t}</p>`;
const details = (rows) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 14px;border-collapse:collapse;">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#8b8b9a;font-size:13px;width:40%;">${k}</td><td style="padding:6px 0;color:#e8e8ef;font-size:13px;">${v}</td></tr>`,
    )
    .join('')}</table>`;

export const DEFAULT_TEMPLATES = {
  account_verification: {
    name: 'Email Verification', category: 'Account',
    subject: 'Verify your {{platformName}} email',
    variables: ['name', 'code', 'link', 'platformName'],
    preheader: 'Confirm your email to activate your account.',
    html: h('Verify your email') + p('Hi {{name}},') + p('Use the code below to verify your email address. It expires in 10 minutes.') +
      `<p style="font-size:30px;font-weight:700;letter-spacing:8px;color:#ffffff;margin:8px 0;">{{code}}</p>` +
      button('{{link}}', 'Verify email') + muted('If you didn’t create an account, you can ignore this email.'),
  },
  welcome: {
    name: 'Welcome & Onboarding', category: 'Account',
    subject: 'Welcome to {{platformName}}, {{name}}! 🎉',
    variables: ['name', 'link', 'platformName'],
    preheader: 'Your account is ready — here’s how to get started.',
    html: h('Welcome aboard!') + p('Hi {{name}},') + p('Your {{platformName}} account is ready. Set up your first job, invite your team, and start running AI interviews in minutes.') +
      button('{{link}}', 'Go to dashboard'),
  },
  password_reset: {
    name: 'Password Reset', category: 'Security',
    subject: 'Reset your {{platformName}} password',
    variables: ['name', 'code', 'link'],
    preheader: 'Reset your password — link valid for 15 minutes.',
    html: h('Reset your password') + p('Hi {{name}},') + p('We received a request to reset your password. Use this code (valid 15 minutes):') +
      `<p style="font-size:26px;font-weight:700;letter-spacing:6px;color:#ffffff;margin:8px 0;">{{code}}</p>` +
      button('{{link}}', 'Reset password') + muted('Didn’t request this? Your password is unchanged — you can safely ignore this email.'),
  },
  security_alert: {
    name: 'Security Alert', category: 'Security',
    subject: 'Security alert on your {{platformName}} account',
    variables: ['name', 'event', 'ip', 'time'],
    preheader: 'A new security event on your account.',
    html: h('Security alert') + p('Hi {{name}},') + p('We noticed the following activity on your account:') +
      details([['Event', '{{event}}'], ['IP address', '{{ip}}'], ['Time', '{{time}}']]) +
      muted('If this was you, no action is needed. Otherwise, reset your password immediately.'),
  },
  login_otp: {
    name: 'Login Code (OTP)', category: 'Security',
    subject: 'Your {{platformName}} login code',
    variables: ['name', 'code'],
    preheader: 'Your one-time login code.',
    html: h('Your login code') + p('Hi {{name}},') + p('Use this one-time code to sign in (valid 5 minutes):') +
      `<p style="font-size:30px;font-weight:700;letter-spacing:8px;color:#ffffff;margin:8px 0;">{{code}}</p>`,
  },

  interview_invite: {
    name: 'Interview Invitation', category: 'Interview',
    subject: 'You’re invited to an AI interview for {{jobTitle}}',
    variables: ['name', 'jobTitle', 'company', 'link', 'expiresAt'],
    preheader: 'Your interview link is ready.',
    html: h('Interview invitation') + p('Hi {{name}},') + p('{{company}} has invited you to complete an AI-powered interview for the <strong>{{jobTitle}}</strong> role. You can take it anytime before {{expiresAt}}.') +
      button('{{link}}', 'Start interview') + muted('Find a quiet space with a working camera, microphone, and stable internet.'),
  },
  interview_schedule: {
    name: 'Interview Scheduled', category: 'Interview',
    subject: 'Your {{jobTitle}} interview is scheduled',
    variables: ['name', 'jobTitle', 'scheduledAt', 'link'],
    preheader: 'Interview scheduling confirmation.',
    html: h('Interview scheduled') + p('Hi {{name}},') + p('Your interview for <strong>{{jobTitle}}</strong> is scheduled.') +
      details([['Date & time', '{{scheduledAt}}'], ['Role', '{{jobTitle}}']]) + button('{{link}}', 'View details'),
  },
  interview_reminder: {
    name: 'Interview Reminder', category: 'Interview',
    subject: 'Reminder: your {{jobTitle}} interview',
    variables: ['name', 'jobTitle', 'scheduledAt', 'link'],
    preheader: 'Your interview is coming up.',
    html: h('Interview reminder') + p('Hi {{name}},') + p('This is a friendly reminder about your upcoming interview for <strong>{{jobTitle}}</strong> at {{scheduledAt}}.') +
      button('{{link}}', 'Start interview'),
  },
  interview_started: {
    name: 'Interview Started', category: 'Interview',
    subject: '{{name}} started the {{jobTitle}} interview',
    variables: ['name', 'jobTitle', 'company', 'link'],
    preheader: 'An interview is in progress.',
    html: h('Interview in progress') + p('{{name}} has started the AI interview for <strong>{{jobTitle}}</strong>. You’ll be notified with results when it completes.') +
      button('{{link}}', 'Track live'),
  },
  interview_completed: {
    name: 'Interview Completed', category: 'Interview',
    subject: 'Interview completed — {{jobTitle}}',
    variables: ['name', 'jobTitle', 'link'],
    preheader: 'The interview has finished.',
    html: h('Interview completed') + p('Hi {{name}},') + p('Thank you for completing your interview for <strong>{{jobTitle}}</strong>. The hiring team is reviewing your results and will be in touch.') +
      button('{{link}}', 'View status'),
  },
  interview_result: {
    name: 'Interview Result', category: 'Interview',
    subject: 'Your {{jobTitle}} interview results are ready',
    variables: ['name', 'jobTitle', 'score', 'recommendation', 'link'],
    preheader: 'Your AI interview report is available.',
    html: h('Your interview results') + p('Hi {{name}},') + p('Your AI evaluation for <strong>{{jobTitle}}</strong> is ready.') +
      details([['Overall score', '{{score}}'], ['Recommendation', '{{recommendation}}']]) + button('{{link}}', 'View full report'),
  },

  application_confirmation: {
    name: 'Application Confirmation', category: 'Candidate',
    subject: 'We received your application for {{jobTitle}}',
    variables: ['name', 'jobTitle', 'company'],
    preheader: 'Application received.',
    html: h('Application received') + p('Hi {{name}},') + p('Thanks for applying to <strong>{{jobTitle}}</strong> at {{company}}. We’ve received your application and will review it shortly.'),
  },
  candidate_shortlisted: {
    name: 'Candidate Shortlisted', category: 'Candidate',
    subject: 'Good news — you’ve been shortlisted for {{jobTitle}}',
    variables: ['name', 'jobTitle', 'company', 'link'],
    preheader: 'You’ve moved to the next stage.',
    html: h('You’ve been shortlisted! 🎯') + p('Hi {{name}},') + p('Great news — you’ve been shortlisted for <strong>{{jobTitle}}</strong> at {{company}}. We’ll share next steps soon.') +
      button('{{link}}', 'View status'),
  },
  candidate_selected: {
    name: 'Candidate Selected', category: 'Candidate',
    subject: 'Congratulations! You’ve been selected for {{jobTitle}}',
    variables: ['name', 'jobTitle', 'company', 'link'],
    preheader: 'A hiring decision in your favour.',
    html: h('Congratulations! 🎉') + p('Hi {{name}},') + p('We’re delighted to let you know you’ve been selected for <strong>{{jobTitle}}</strong> at {{company}}. Our team will reach out with the details.') +
      button('{{link}}', 'View offer'),
  },
  candidate_rejected: {
    name: 'Candidate Rejection', category: 'Candidate',
    subject: 'Update on your {{jobTitle}} application',
    variables: ['name', 'jobTitle', 'company'],
    preheader: 'An update on your application.',
    html: h('Application update') + p('Hi {{name}},') + p('Thank you for your interest in <strong>{{jobTitle}}</strong> at {{company}} and for the time you invested. After careful consideration, we won’t be moving forward at this time. We genuinely wish you the best and encourage you to apply for future roles.'),
  },

  staff_invite: {
    name: 'Staff Invitation', category: 'Team',
    subject: 'You’ve been invited to join {{company}} on {{platformName}}',
    variables: ['name', 'company', 'role', 'link', 'platformName'],
    preheader: 'Accept your team invitation.',
    html: h('You’re invited to the team') + p('Hi {{name}},') + p('{{company}} has invited you to join their workspace on {{platformName}} as <strong>{{role}}</strong>.') +
      button('{{link}}', 'Accept invitation') + muted('This invitation link will expire in 7 days.'),
  },

  subscription_confirmation: {
    name: 'Subscription Confirmation', category: 'Billing',
    subject: 'Your {{planName}} subscription is active',
    variables: ['name', 'planName', 'amount', 'renewalDate', 'link'],
    preheader: 'Subscription activated.',
    html: h('Subscription active') + p('Hi {{name}},') + p('Your <strong>{{planName}}</strong> plan is now active. Thank you for your subscription!') +
      details([['Plan', '{{planName}}'], ['Amount', '{{amount}}'], ['Renews', '{{renewalDate}}']]) + button('{{link}}', 'Manage billing'),
  },
  payment_receipt: {
    name: 'Payment Receipt', category: 'Billing',
    subject: 'Payment received — {{amount}}',
    variables: ['name', 'amount', 'invoiceNumber', 'date', 'link'],
    preheader: 'Thanks — your payment was received.',
    html: h('Payment received') + p('Hi {{name}},') + p('We’ve received your payment. A receipt is below.') +
      details([['Invoice', '{{invoiceNumber}}'], ['Amount', '{{amount}}'], ['Date', '{{date}}']]) + button('{{link}}', 'Download invoice'),
  },
  invoice: {
    name: 'Invoice', category: 'Billing',
    subject: 'Invoice {{invoiceNumber}} from {{platformName}}',
    variables: ['name', 'invoiceNumber', 'amount', 'dueDate', 'link'],
    preheader: 'Your invoice is ready.',
    html: h('Invoice {{invoiceNumber}}') + p('Hi {{name}},') + p('Please find your invoice details below.') +
      details([['Invoice', '{{invoiceNumber}}'], ['Amount due', '{{amount}}'], ['Due date', '{{dueDate}}']]) + button('{{link}}', 'View & pay'),
  },
  trial_expiry: {
    name: 'Trial Expiry', category: 'Billing',
    subject: 'Your {{platformName}} trial ends in {{daysLeft}} days',
    variables: ['name', 'daysLeft', 'link', 'platformName'],
    preheader: 'Your trial is ending soon.',
    html: h('Your trial is ending') + p('Hi {{name}},') + p('Your free trial ends in <strong>{{daysLeft}} days</strong>. Upgrade now to keep your jobs, candidates, and interviews running without interruption.') +
      button('{{link}}', 'Upgrade now'),
  },
  renewal_reminder: {
    name: 'Renewal Reminder', category: 'Billing',
    subject: 'Your {{planName}} plan renews on {{renewalDate}}',
    variables: ['name', 'planName', 'amount', 'renewalDate', 'link'],
    preheader: 'Upcoming subscription renewal.',
    html: h('Upcoming renewal') + p('Hi {{name}},') + p('Your <strong>{{planName}}</strong> subscription will renew on {{renewalDate}} for {{amount}}.') +
      button('{{link}}', 'Manage subscription'),
  },

  support_ticket: {
    name: 'Support Ticket Update', category: 'Support',
    subject: '[#{{ticketId}}] {{subject}}',
    variables: ['name', 'ticketId', 'subject', 'status', 'message', 'link'],
    preheader: 'An update on your support ticket.',
    html: h('Support update') + p('Hi {{name}},') + p('There’s an update on your support ticket <strong>#{{ticketId}}</strong> (status: {{status}}).') +
      `<blockquote style="margin:12px 0;padding:12px 16px;border-left:3px solid #7c5cff;background:#1d1d27;border-radius:8px;color:#d7d7e0;">{{message}}</blockquote>` +
      button('{{link}}', 'View ticket'),
  },
  system_notification: {
    name: 'System Notification', category: 'System',
    subject: '{{subject}}',
    variables: ['name', 'subject', 'message', 'link'],
    preheader: '{{subject}}',
    html: h('{{subject}}') + p('Hi {{name}},') + p('{{message}}') + button('{{link}}', 'Open dashboard'),
  },
};

export const TEMPLATE_KEYS = Object.keys(DEFAULT_TEMPLATES);

export default DEFAULT_TEMPLATES;
