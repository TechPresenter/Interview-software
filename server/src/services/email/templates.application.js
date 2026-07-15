import { h, p, muted, list, button, divider, infoCard, statusPill } from './components.js';

/**
 * Built-in templates for the public "Apply for Interview" module.
 *
 * Same contract as templates.js — these are merged into DEFAULT_TEMPLATES and are
 * indistinguishable from it once spread. They live in their own file only because
 * the module owns them end to end (model, service, admin screen); nothing here
 * may assume it is imported second.
 *
 * Two rules from the module shape everything below:
 *
 *  - A payment claim is not a payment. The Pay Now button is a redirect to a URL
 *    the admin configures and nothing comes back, so `claimed` means the applicant
 *    pasted a reference and `verified` means a human checked it. Neither of these
 *    emails may render the applicant's word as "Paid" — see APPLICATION_PAYMENT_STATUS.
 *  - The candidate mail carries no route to the uploaded files. Resumes and photos
 *    are served through an admin-authenticated route precisely so that no link to a
 *    stranger's CV exists outside the admin panel; an email is forwarded, archived
 *    and indexed, which is the one place such a link must never reach.
 *
 * Bodies are static strings built at import time, so a statusPill tone cannot be
 * chosen from a runtime var — where a tone is fixed below, a comment says why the
 * fixed one is honest.
 */

export const APPLICATION_TEMPLATES = {
  'application.received': {
    name: 'Interview Application — Received',
    category: 'Application',
    // Only the server-minted id goes in the subject. The subject is interpolated
    // with RAW vars (escaping it would ship a literal "&amp;"), and every other
    // field here was typed by an unauthenticated stranger.
    subject: 'We received your application — {{applicationId}}',
    variables: [
      'name',
      'applicationId',
      'submittedAt',
      'preferredJobRole',
      'currency',
      'fee',
      'paymentStatus',
      'paymentReference',
      'platformName',
    ],
    // The id belongs in the preview line too: it is what they search their inbox
    // for six weeks from now, when they need to quote it.
    preheader: 'Application {{applicationId}} received — keep this id for any query.',
    html:
      h('Application received') +
      p('Hi {{name}},') +
      p(
        'Thanks for applying to interview with {{platformName}}. Your application is in, and its reference is <strong>{{applicationId}}</strong> — quote that id in any email or call about it and we’ll find you straight away.',
      ) +
      infoCard('Your application', [
        ['Application ID', '{{applicationId}}'],
        ['Submitted', '{{submittedAt}}'],
        ['Preferred role', '{{preferredJobRole}}'],
        // 'Received' rather than the stored 'pending': the record's word for
        // "nobody has looked yet" reads to an applicant as "something stalled".
        ['Status', statusPill('Received', 'info')],
      ]) +
      // `warning` is honest for every state this template can be sent in.
      // createApplication only ever writes `unpaid` or `claimed`, and verification
      // is a later, deliberate admin act — so at send time the fee is never
      // settled, and a success tone here would be the "Paid" lie the module exists
      // to prevent. Anything sent after verification is a different email.
      infoCard('Application fee', [
        ['Amount', '{{currency}} {{fee}}'],
        ['Your reference', '{{paymentReference}}'],
        ['Status', statusPill('{{paymentStatus}}', 'warning')],
      ]) +
      p(
        'A reference you gave us is your record of payment, not ours — we mark the fee as verified only once someone has checked it against the provider. <strong>This email is a confirmation of your application, not a receipt.</strong>',
      ) +
      p('<strong>What happens next</strong>') +
      list([
        'We confirm your fee against the payment provider.',
        'Our team reviews your application and your CV.',
        'You get an email either way — shortlisted, or not this time.',
      ]) +
      divider() +
      muted(
        'There’s nothing you need to do in the meantime, and no need to apply again — a second application for the same email or mobile is rejected while this one is open. Something wrong with your details? Reply to this email quoting {{applicationId}}.',
      ),
  },

  'application.admin.new': {
    name: 'Interview Application — New (Admin)',
    category: 'Application',
    // Mirrors contact_notification's subject shape: the queue is triaged from the
    // inbox list, so the role earns its place next to the id.
    subject: 'New application {{applicationId}} — {{preferredJobRole}}',
    variables: [
      'applicationId',
      'name',
      'email',
      'mobile',
      'preferredJobRole',
      'submittedAt',
      'currency',
      'fee',
      'paymentStatus',
      'paymentReference',
      'adminUrl',
    ],
    preheader: 'New interview application from {{name}}.',
    // No greeting: `name` is the applicant here, not the recipient. Same shape as
    // contact_notification, which is the other mail addressed to the team about
    // someone else.
    html:
      h('New interview application') +
      p('An application landed on the public form and is waiting in the review queue.') +
      infoCard('Applicant', [
        ['Application ID', '{{applicationId}}'],
        ['Name', '{{name}}'],
        ['Email', '{{email}}'],
        ['Mobile', '{{mobile}}'],
        ['Preferred role', '{{preferredJobRole}}'],
        ['Submitted', '{{submittedAt}}'],
      ]) +
      // Fixed `warning` for the same reason as the applicant's copy: nothing is
      // verified at submission, and this card is the prompt to go and verify it.
      infoCard('Payment claim', [
        ['Amount', '{{currency}} {{fee}}'],
        ['Reference given', '{{paymentReference}}'],
        ['Status', statusPill('{{paymentStatus}}', 'warning')],
      ]) +
      p(
        'The reference above is the applicant’s claim and nothing more — the payment link is a one-way redirect. Check it against the provider before you mark it verified.',
      ) +
      button('{{adminUrl}}', 'Review application') +
      muted(
        'The CV and photo are on the application page behind your login. They are deliberately neither attached to nor linked from this email.',
      ),
  },
};

export default APPLICATION_TEMPLATES;
