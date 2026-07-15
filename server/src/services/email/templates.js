import {
  h,
  p,
  muted,
  list,
  button,
  divider,
  infoCard,
  otpCode,
  statusPill,
  securityNotice,
  credentialsCard,
} from './components.js';
import { APPLICATION_TEMPLATES } from './templates.application.js';

/**
 * Built-in default email templates. Each can be overridden per-platform via the
 * Template collection (admin Email editor). Bodies are the inner content only —
 * the branded shell (layout.js) supplies the header, footer, contact details and
 * legal line, so nothing here repeats them.
 *
 * Placeholders use {{handlebars}} and are interpolated by template.service at
 * send time. A template's `variables` list is a contract with its call site: a
 * placeholder the call site does not pass renders as an empty string, silently.
 * Keep the two in step — test/email.templates.test.js asserts that every
 * placeholder is declared and every declared variable is actually used.
 *
 * `platformName`, `name` and `dashboardUrl` are injected for every send by
 * email.service's mergedVars, so they are always safe to reference (`name`
 * degrades to "there" where the call site has no real name to pass).
 */

export const DEFAULT_TEMPLATES = {
  account_verification: {
    name: 'Email Verification',
    category: 'Account',
    subject: 'Verify your {{platformName}} email',
    variables: ['name', 'code', 'link', 'platformName'],
    preheader: 'Confirm your email to activate your account.',
    html:
      h('Verify your email') +
      p('Hi {{name}},') +
      p('Use the code below to finish setting up your {{platformName}} account. It expires in 10 minutes.') +
      otpCode('{{code}}') +
      p('Or verify in one click:') +
      button('{{link}}', 'Verify email') +
      securityNotice('If you didn’t create an account, you can ignore this email — nothing will be activated without this code.'),
  },

  welcome: {
    name: 'Welcome & Onboarding',
    category: 'Account',
    subject: 'Welcome to {{platformName}}, {{name}}! 🎉',
    variables: ['name', 'link', 'platformName'],
    preheader: 'Your account is ready — here’s how to get started.',
    html:
      h('Welcome aboard') +
      p('Hi {{name}},') +
      p('Your {{platformName}} account is ready. Three steps to your first AI interview:') +
      list([
        '<strong>Post a job</strong> — describe the role and we’ll draft the question set.',
        '<strong>Invite candidates</strong> — bulk upload or share a link.',
        '<strong>Review results</strong> — scored transcripts and a recommendation for each candidate.',
      ]) +
      button('{{link}}', 'Go to dashboard') +
      muted('Stuck on something? Reply to this email — it reaches a real person.'),
  },

  company_registration: {
    name: 'Company Registration',
    category: 'Account',
    subject: 'Your {{platformName}} workspace for {{company}} is ready',
    variables: ['name', 'company', 'email', 'password', 'link', 'platformName'],
    preheader: 'Your workspace is live — sign-in details inside.',
    html:
      h('Your workspace is ready') +
      p('Hi {{name}},') +
      p('We’ve created the <strong>{{company}}</strong> workspace on {{platformName}}. Sign in with the temporary credentials below.') +
      credentialsCard([
        ['Workspace', '{{company}}'],
        ['Email', '{{email}}'],
        ['Temporary password', '{{password}}'],
      ]) +
      button('{{link}}', 'Sign in') +
      muted('This temporary password stops working once you set your own.'),
  },

  account_status_update: {
    name: 'Account Status Update',
    category: 'Account',
    subject: 'Your {{platformName}} account status has changed',
    variables: ['name', 'newStatus', 'reason', 'link', 'platformName'],
    preheader: 'An important update about your account.',
    html:
      h('Account status update') +
      p('Hi {{name}},') +
      p('The status of your {{platformName}} account has changed.') +
      infoCard('Account', [
        ['New status', statusPill('{{newStatus}}', 'warning')],
        ['Reason', '{{reason}}'],
      ]) +
      p('If you believe this is a mistake, or you’d like to discuss it, contact our team and we’ll look into it right away.') +
      button('{{link}}', 'Contact support'),
  },

  password_reset: {
    name: 'Password Reset',
    category: 'Security',
    subject: 'Reset your {{platformName}} password',
    // `platformName` is rendered by the subject and arrives via mergedVars; it
    // has to be declared here or it never reaches the admin variable chips.
    variables: ['name', 'code', 'link', 'platformName'],
    preheader: 'Reset your password — code valid for 15 minutes.',
    html:
      h('Reset your password') +
      p('Hi {{name}},') +
      p('We received a request to reset your password. Use this code — it’s valid for 15 minutes:') +
      otpCode('{{code}}') +
      button('{{link}}', 'Reset password') +
      securityNotice('Didn’t request this? Your password is unchanged and you can safely ignore this email. If you get these repeatedly, someone may know your address — consider signing in and reviewing your account.'),
  },

  password_changed: {
    name: 'Password Changed',
    category: 'Security',
    subject: 'Your {{platformName}} password was changed',
    variables: ['name', 'time', 'link', 'platformName'],
    preheader: 'Confirmation of a password change on your account.',
    html:
      h('Your password was changed') +
      p('Hi {{name}},') +
      p('The password on your {{platformName}} account was changed successfully.') +
      infoCard('Change details', [['When', '{{time}}']]) +
      securityNotice('If this wasn’t you, reset your password immediately and review recent activity — whoever made this change can currently sign in.') +
      button('{{link}}', 'Review account security'),
  },

  security_alert: {
    name: 'Security Alert',
    category: 'Security',
    subject: 'Security alert on your {{platformName}} account',
    variables: ['name', 'event', 'ip', 'time', 'platformName'],
    preheader: 'A new security event on your account.',
    html:
      h('Security alert') +
      p('Hi {{name}},') +
      p('We noticed the following activity on your {{platformName}} account:') +
      infoCard('Activity', [
        ['Event', '{{event}}'],
        ['IP address', '{{ip}}'],
        ['When', '{{time}}'],
      ]) +
      securityNotice('If this was you, no action is needed. If not, reset your password immediately and sign out of other sessions.'),
  },

  login_otp: {
    name: 'Login Code (OTP)',
    category: 'Security',
    subject: 'Your {{platformName}} login code',
    variables: ['name', 'code', 'platformName'],
    preheader: 'Your one-time login code.',
    html:
      h('Your login code') +
      p('Hi {{name}},') +
      p('Use this one-time code to sign in. It expires in 5 minutes:') +
      otpCode('{{code}}') +
      securityNotice('Never share this code. {{platformName}} staff will never ask you for it — anyone who does is trying to access your account.'),
  },

  interview_invite: {
    name: 'Interview Invitation',
    category: 'Interview',
    subject: 'You’re invited to an AI interview for {{jobTitle}}',
    variables: ['name', 'jobTitle', 'company', 'link', 'expiresAt'],
    preheader: 'Your interview link is ready.',
    html:
      h('You’re invited to interview') +
      p('Hi {{name}},') +
      p('{{company}} has invited you to complete an AI-powered interview for the <strong>{{jobTitle}}</strong> role. Take it whenever suits you — no scheduling needed.') +
      infoCard('Interview details', [
        ['Role', '{{jobTitle}}'],
        ['Company', '{{company}}'],
        ['Complete by', '{{expiresAt}}'],
      ]) +
      button('{{link}}', 'Start interview') +
      divider() +
      muted('<strong>Before you start:</strong> find a quiet space, check your camera and microphone, and make sure your internet is stable. The link above works on desktop and mobile.'),
  },

  interview_schedule: {
    name: 'Interview Scheduled',
    category: 'Interview',
    subject: 'Your {{jobTitle}} interview is scheduled',
    variables: ['name', 'jobTitle', 'scheduledAt', 'link'],
    preheader: 'Interview scheduling confirmation.',
    html:
      h('Interview scheduled') +
      p('Hi {{name}},') +
      p('Your interview for <strong>{{jobTitle}}</strong> is confirmed.') +
      infoCard('Your interview', [
        ['Role', '{{jobTitle}}'],
        ['Date & time', '{{scheduledAt}}'],
        ['Status', statusPill('Confirmed', 'success')],
      ]) +
      button('{{link}}', 'View details') +
      muted('Add this to your calendar so it doesn’t slip by.'),
  },

  interview_rescheduled: {
    name: 'Interview Rescheduled',
    category: 'Interview',
    subject: 'Your {{jobTitle}} interview has moved',
    variables: ['name', 'jobTitle', 'company', 'previousAt', 'scheduledAt', 'link'],
    preheader: 'Your interview has a new date and time.',
    html:
      h('Your interview has moved') +
      p('Hi {{name}},') +
      p('{{company}} has rescheduled your interview for <strong>{{jobTitle}}</strong>. The new time is below — the old slot is no longer valid.') +
      infoCard('Updated schedule', [
        ['Role', '{{jobTitle}}'],
        ['Was', '{{previousAt}}'],
        ['Now', '{{scheduledAt}}'],
        ['Status', statusPill('Rescheduled', 'warning')],
      ]) +
      button('{{link}}', 'View details') +
      muted('Please update your calendar. If the new time doesn’t work, reply to this email and we’ll find another.'),
  },

  interview_cancelled: {
    name: 'Interview Cancelled',
    category: 'Interview',
    subject: 'Your {{jobTitle}} interview has been cancelled',
    variables: ['name', 'jobTitle', 'company', 'reason', 'link'],
    preheader: 'Your interview has been cancelled.',
    html:
      h('Interview cancelled') +
      p('Hi {{name}},') +
      p('Your interview for <strong>{{jobTitle}}</strong> at {{company}} has been cancelled. We’re sorry for the disruption.') +
      infoCard('Cancellation', [
        ['Role', '{{jobTitle}}'],
        ['Status', statusPill('Cancelled', 'danger')],
        ['Reason', '{{reason}}'],
      ]) +
      p('Your application is still open — if a new slot opens up, we’ll be in touch.') +
      button('{{link}}', 'View application'),
  },

  interview_reminder: {
    name: 'Interview Reminder',
    category: 'Interview',
    subject: 'Reminder: your {{jobTitle}} interview',
    variables: ['name', 'jobTitle', 'scheduledAt', 'link'],
    preheader: 'Your interview is coming up.',
    html:
      h('Your interview is coming up') +
      p('Hi {{name}},') +
      p('A friendly reminder about your upcoming interview for <strong>{{jobTitle}}</strong>.') +
      infoCard('When', [['Date & time', '{{scheduledAt}}']]) +
      button('{{link}}', 'Start interview') +
      muted('Give yourself a few minutes to test your camera and microphone beforehand.'),
  },

  interview_started: {
    name: 'Interview Started',
    category: 'Interview',
    subject: '{{name}} started the {{jobTitle}} interview',
    variables: ['name', 'jobTitle', 'company', 'link'],
    preheader: 'An interview is in progress.',
    html:
      h('Interview in progress') +
      p('<strong>{{name}}</strong> has started the AI interview for <strong>{{jobTitle}}</strong> at {{company}}.') +
      infoCard('Session', [
        ['Candidate', '{{name}}'],
        ['Role', '{{jobTitle}}'],
        ['Status', statusPill('In progress', 'info')],
      ]) +
      p('You’ll get the scored report as soon as it finishes.') +
      button('{{link}}', 'Track live'),
  },

  interview_completed: {
    name: 'Interview Completed',
    category: 'Interview',
    subject: 'Interview completed — {{jobTitle}}',
    variables: ['name', 'jobTitle', 'link'],
    preheader: 'The interview has finished.',
    html:
      h('Interview completed') +
      p('Hi {{name}},') +
      p('Thank you for completing your interview for <strong>{{jobTitle}}</strong>. That’s everything we need from you for now.') +
      infoCard('What happens next', [
        ['Status', statusPill('Under review', 'info')],
        ['Next step', 'The hiring team reviews your results and will be in touch.'],
      ]) +
      button('{{link}}', 'View status'),
  },

  interview_result: {
    name: 'Interview Result',
    category: 'Interview',
    subject: 'Your {{jobTitle}} interview results are ready',
    variables: ['name', 'jobTitle', 'score', 'recommendation', 'link'],
    preheader: 'Your AI interview report is available.',
    html:
      h('Your interview results') +
      p('Hi {{name}},') +
      p('The AI evaluation for <strong>{{jobTitle}}</strong> is ready.') +
      infoCard('Summary', [
        ['Overall score', '{{score}}'],
        ['Recommendation', '{{recommendation}}'],
      ]) +
      button('{{link}}', 'View full report'),
  },

  candidate_registration: {
    name: 'Candidate Registration',
    category: 'Candidate',
    subject: 'Your candidate profile at {{company}} is set up',
    variables: ['name', 'company', 'email', 'link'],
    preheader: 'Your candidate profile is ready.',
    html:
      h('Your profile is set up') +
      p('Hi {{name}},') +
      p('{{company}} has added you as a candidate. You can track your applications and complete interviews from your profile.') +
      infoCard('Your profile', [
        ['Registered email', '{{email}}'],
        ['Company', '{{company}}'],
      ]) +
      button('{{link}}', 'View your profile') +
      muted('Keep this email — it has the link you’ll need to check your progress.'),
  },

  application_confirmation: {
    name: 'Application Confirmation',
    category: 'Candidate',
    subject: 'We received your application for {{jobTitle}}',
    variables: ['name', 'jobTitle', 'company'],
    preheader: 'Application received.',
    html:
      h('Application received') +
      p('Hi {{name}},') +
      p('Thanks for applying to <strong>{{jobTitle}}</strong> at {{company}}. Your application is in and we’ll review it shortly.') +
      infoCard('Your application', [
        ['Role', '{{jobTitle}}'],
        ['Company', '{{company}}'],
        ['Status', statusPill('Received', 'info')],
      ]) +
      muted('We’ll email you as soon as there’s an update — there’s nothing you need to do in the meantime.'),
  },

  candidate_shortlisted: {
    name: 'Candidate Shortlisted',
    category: 'Candidate',
    subject: 'Good news — you’ve been shortlisted for {{jobTitle}}',
    variables: ['name', 'jobTitle', 'company', 'link'],
    preheader: 'You’ve moved to the next stage.',
    html:
      h('You’ve been shortlisted 🎯') +
      p('Hi {{name}},') +
      p('Great news — you’ve been shortlisted for <strong>{{jobTitle}}</strong> at {{company}}. Your application stood out and you’re through to the next stage.') +
      infoCard('Your application', [
        ['Role', '{{jobTitle}}'],
        ['Company', '{{company}}'],
        ['Status', statusPill('Shortlisted', 'success')],
      ]) +
      button('{{link}}', 'View status') +
      muted('We’ll share next steps shortly.'),
  },

  candidate_selected: {
    name: 'Candidate Selected',
    category: 'Candidate',
    subject: 'Congratulations! You’ve been selected for {{jobTitle}}',
    variables: ['name', 'jobTitle', 'company', 'link'],
    preheader: 'A hiring decision in your favour.',
    html:
      h('Congratulations! 🎉') +
      p('Hi {{name}},') +
      p('We’re delighted to tell you you’ve been selected for <strong>{{jobTitle}}</strong> at {{company}}.') +
      infoCard('Your application', [
        ['Role', '{{jobTitle}}'],
        ['Company', '{{company}}'],
        ['Status', statusPill('Selected', 'success')],
      ]) +
      p('Our team will reach out with the details and next steps.') +
      button('{{link}}', 'View details'),
  },

  offer_letter: {
    name: 'Offer Letter',
    category: 'Candidate',
    subject: 'Your offer for {{jobTitle}} at {{company}}',
    variables: ['name', 'jobTitle', 'company', 'salary', 'startDate', 'link'],
    preheader: 'Your written offer is ready to review.',
    html:
      h('Your offer is ready') +
      p('Hi {{name}},') +
      p('We’re pleased to offer you the <strong>{{jobTitle}}</strong> role at {{company}}. The headline terms are below — the full written offer is on the link.') +
      infoCard('Offer terms', [
        ['Role', '{{jobTitle}}'],
        ['Company', '{{company}}'],
        ['Compensation', '{{salary}}'],
        ['Proposed start date', '{{startDate}}'],
      ]) +
      button('{{link}}', 'Review & respond') +
      divider() +
      muted('This summary is for convenience only — the linked document is the offer that counts. Questions before you decide? Reply to this email and we’ll talk it through.'),
  },

  candidate_rejected: {
    name: 'Candidate Rejection',
    category: 'Candidate',
    subject: 'Update on your {{jobTitle}} application',
    // The pipeline call site passes `link` for all three decision stages, so it
    // is spent on a route back to the careers list rather than dropped.
    variables: ['name', 'jobTitle', 'company', 'link'],
    preheader: 'An update on your application.',
    html:
      h('Application update') +
      p('Hi {{name}},') +
      p('Thank you for your interest in <strong>{{jobTitle}}</strong> at {{company}}, and for the time you put into your application.') +
      p('After careful consideration we won’t be moving forward on this occasion. This was a difficult decision and it isn’t a reflection of your ability — we simply had to choose against a specific set of needs for this role.') +
      p('We’d genuinely welcome an application from you for a future opening.') +
      button('{{link}}', 'See other roles'),
  },

  staff_invite: {
    name: 'Staff Invitation',
    category: 'Team',
    subject: 'You’ve been invited to join {{company}} on {{platformName}}',
    variables: ['name', 'company', 'role', 'link', 'platformName'],
    preheader: 'Accept your team invitation.',
    html:
      h('You’re invited to the team') +
      p('Hi {{name}},') +
      p('{{company}} has invited you to join their workspace on {{platformName}}.') +
      infoCard('Invitation', [
        ['Workspace', '{{company}}'],
        ['Your role', '{{role}}'],
      ]) +
      button('{{link}}', 'Accept invitation') +
      securityNotice('This invitation expires in 7 days and can only be accepted once. If you weren’t expecting it, you can ignore this email.'),
  },

  subscription_confirmation: {
    name: 'Subscription Confirmation',
    category: 'Billing',
    subject: 'Your {{planName}} subscription is active',
    variables: ['name', 'planName', 'amount', 'renewalDate', 'link'],
    preheader: 'Subscription activated.',
    html:
      h('Subscription active') +
      p('Hi {{name}},') +
      p('Your <strong>{{planName}}</strong> plan is now active. Thank you for your subscription.') +
      infoCard('Your plan', [
        ['Plan', '{{planName}}'],
        ['Amount', '{{amount}}'],
        ['Renews on', '{{renewalDate}}'],
        ['Status', statusPill('Active', 'success')],
      ]) +
      button('{{link}}', 'Manage billing'),
  },

  payment_receipt: {
    name: 'Payment Receipt',
    category: 'Billing',
    subject: 'Payment received — {{amount}}',
    variables: ['name', 'amount', 'invoiceNumber', 'date', 'link'],
    preheader: 'Thanks — your payment was received.',
    html:
      h('Payment received') +
      p('Hi {{name}},') +
      p('We’ve received your payment. Keep this receipt for your records.') +
      infoCard('Receipt', [
        ['Invoice', '{{invoiceNumber}}'],
        ['Amount', '{{amount}}'],
        ['Date', '{{date}}'],
        ['Status', statusPill('Paid', 'success')],
      ]) +
      button('{{link}}', 'Download invoice'),
  },

  invoice: {
    name: 'Invoice',
    category: 'Billing',
    subject: 'Invoice {{invoiceNumber}} from {{platformName}}',
    variables: ['name', 'invoiceNumber', 'amount', 'dueDate', 'link', 'platformName'],
    preheader: 'Your invoice is ready.',
    html:
      h('Invoice {{invoiceNumber}}') +
      p('Hi {{name}},') +
      p('Your latest invoice from {{platformName}} is ready.') +
      infoCard('Invoice', [
        ['Invoice number', '{{invoiceNumber}}'],
        ['Amount due', '{{amount}}'],
        ['Due date', '{{dueDate}}'],
        ['Status', statusPill('Due', 'warning')],
      ]) +
      button('{{link}}', 'View & pay'),
  },

  trial_expiry: {
    name: 'Trial Expiry',
    category: 'Billing',
    subject: 'Your {{platformName}} trial ends in {{daysLeft}} days',
    variables: ['name', 'daysLeft', 'link', 'platformName'],
    preheader: 'Your trial is ending soon.',
    html:
      h('Your trial is ending') +
      p('Hi {{name}},') +
      p('Your free trial ends in <strong>{{daysLeft}} days</strong>. Upgrade now to keep your jobs, candidates and interviews running without interruption.') +
      infoCard('What happens if you don’t upgrade', [
        ['Your data', 'Kept safe — nothing is deleted.'],
        ['Interviews', 'New interviews can’t be started.'],
        ['Reactivation', 'Upgrade any time to pick up where you left off.'],
      ]) +
      button('{{link}}', 'Upgrade now'),
  },

  renewal_reminder: {
    name: 'Renewal Reminder',
    category: 'Billing',
    subject: 'Your {{planName}} plan renews on {{renewalDate}}',
    variables: ['name', 'planName', 'amount', 'renewalDate', 'link'],
    preheader: 'Upcoming subscription renewal.',
    html:
      h('Upcoming renewal') +
      p('Hi {{name}},') +
      p('This is a heads-up that your subscription renews automatically — no action needed if you’re happy to continue.') +
      infoCard('Renewal', [
        ['Plan', '{{planName}}'],
        ['Amount', '{{amount}}'],
        ['Renews on', '{{renewalDate}}'],
      ]) +
      button('{{link}}', 'Manage subscription') +
      muted('Need to change or cancel? Do it before the renewal date and you won’t be charged.'),
  },

  support_ticket: {
    name: 'Support Ticket Update',
    category: 'Support',
    subject: '[#{{ticketId}}] {{subject}}',
    variables: ['name', 'ticketId', 'subject', 'status', 'message', 'link'],
    preheader: 'An update on your support ticket.',
    html:
      h('Support update') +
      p('Hi {{name}},') +
      p('There’s an update on your support ticket <strong>#{{ticketId}}</strong>.') +
      infoCard('Ticket', [
        ['Reference', '#{{ticketId}}'],
        ['Subject', '{{subject}}'],
        ['Status', '{{status}}'],
      ]) +
      p('{{message}}') +
      button('{{link}}', 'View ticket') +
      muted('Replying to this email adds your response to the ticket.'),
  },

  system_notification: {
    name: 'System Notification',
    category: 'System',
    subject: '{{subject}}',
    variables: ['name', 'subject', 'message', 'link'],
    preheader: '{{subject}}',
    html: h('{{subject}}') + p('Hi {{name}},') + p('{{message}}') + button('{{link}}', 'Open dashboard'),
  },

  system_alert: {
    name: 'System Alert',
    category: 'System',
    subject: '[Alert] {{subject}}',
    variables: ['subject', 'message', 'severity', 'time', 'link'],
    preheader: 'A system alert needs your attention.',
    html:
      h('{{subject}}') +
      // The tone is fixed at build time — bodies are static strings, so the pill
      // cannot colour itself from the runtime {{severity}} value.
      infoCard('Alert', [
        ['Severity', statusPill('{{severity}}', 'danger')],
        ['Detected at', '{{time}}'],
      ]) +
      p('{{message}}') +
      button('{{link}}', 'Open dashboard') +
      muted('This is an automated alert from platform monitoring.'),
  },

  contact_ack: {
    name: 'Contact Form — Acknowledgement',
    category: 'Website',
    subject: 'We received your message — {{platformName}}',
    variables: ['name', 'subject', 'platformName', 'link'],
    preheader: 'Thanks for reaching out — we’ll be in touch shortly.',
    html:
      h('Thanks for reaching out') +
      p('Hi {{name}},') +
      p('We’ve received your message about <strong>{{subject}}</strong>. A member of our team will get back to you shortly — typically within one business day.') +
      button('{{link}}', 'Visit {{platformName}}') +
      muted('This is an automated confirmation — there’s no need to reply.'),
  },

  contact_notification: {
    name: 'Contact Form — Team Notification',
    category: 'Website',
    subject: '[Contact] {{subject}} — {{name}}',
    variables: ['name', 'email', 'phone', 'company', 'subject', 'message', 'link'],
    preheader: 'New enquiry from the website contact form.',
    html:
      h('New contact enquiry') +
      infoCard('Sender', [
        ['Name', '{{name}}'],
        ['Email', '{{email}}'],
        ['Phone', '{{phone}}'],
        ['Company', '{{company}}'],
        ['Subject', '{{subject}}'],
      ]) +
      p('<strong>Message</strong>') +
      p('{{message}}') +
      button('{{link}}', 'Open dashboard'),
  },

  newsletter_welcome: {
    name: 'Newsletter — Welcome',
    category: 'Website',
    subject: 'You’re subscribed to {{platformName}} 🎉',
    variables: ['platformName', 'link', 'email'],
    preheader: 'Welcome aboard — here’s what to expect.',
    html:
      h('Welcome aboard 🎉') +
      p('Thanks for subscribing to the {{platformName}} newsletter.') +
      list([
        'Product updates worth knowing about — not every release.',
        'Hiring insights from teams running AI interviews at scale.',
        'The occasional practical tip. No spam, ever.',
      ]) +
      button('{{link}}', 'Explore {{platformName}}') +
      muted('You’re receiving this because {{email}} was subscribed on our website. Every issue includes an unsubscribe link.'),
  },

  newsletter_campaign: {
    name: 'Newsletter — Campaign',
    category: 'Website',
    subject: '{{subject}}',
    variables: ['subject', 'message', 'link', 'platformName', 'unsubscribeUrl'],
    preheader: '{{subject}}',
    html:
      h('{{subject}}') +
      p('{{message}}') +
      button('{{link}}', 'Read more') +
      divider() +
      // Marketing mail must carry its own opt-out: the shell only renders the
      // footer unsubscribe when the send passes `unsubscribeUrl`.
      muted('You’re receiving this because you subscribed to the {{platformName}} newsletter. <a href="{{unsubscribeUrl}}">Unsubscribe</a> at any time.'),
  },

  demo_ack: {
    name: 'Demo Booking — Confirmation',
    category: 'Website',
    subject: 'We received your demo request — {{platformName}}',
    variables: ['name', 'date', 'timeSlot', 'platformName', 'link'],
    preheader: 'Thanks for booking a demo — we’ll confirm the details shortly.',
    html:
      h('Your demo request is in 🎬') +
      p('Hi {{name}},') +
      p('Thanks for requesting a personalised demo of {{platformName}}. Here’s what we have so far:') +
      infoCard('Your request', [
        ['Preferred date', '{{date}}'],
        ['Preferred time', '{{timeSlot}}'],
        ['Status', statusPill('Pending confirmation', 'warning')],
      ]) +
      p('Our team will review and confirm your slot by email shortly. If you need to change anything, just reply to this message.') +
      button('{{link}}', 'Visit {{platformName}}'),
  },

  // The public Apply-for-Interview module. Kept in its own file because it is a
  // self-contained module, but merged HERE because resolveTemplate() only ever
  // looks in DEFAULT_TEMPLATES — an unmerged template is not a missing template,
  // it is an email sent with an empty body and the raw key as its subject.
  ...APPLICATION_TEMPLATES,
};

export const TEMPLATE_KEYS = Object.keys(DEFAULT_TEMPLATES);

export default DEFAULT_TEMPLATES;
