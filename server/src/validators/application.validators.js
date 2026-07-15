import { z } from 'zod';
import { EXPERIENCE_TYPE } from '../constants/enums.js';
import { emptyToUndefined, optionalEnum } from './shared.js';

/**
 * The public application form's payload.
 *
 * Two things shape every line of this file.
 *
 * FIRST: it is multipart. Everything arrives as a string — numbers as '2019',
 * booleans as 'true', arrays as a repeated field or a JSON blob — so coercion is
 * not a convenience here, it is the only way the typed model ever gets typed
 * values. Each coercion below is deliberate and says what it is defending
 * against, because the obvious spelling of most of them is wrong in a way that
 * fails silently (see `declaration` and `optionalNumber`).
 *
 * SECOND: it is unauthenticated. Whatever is not in this schema does not exist —
 * zod strips unknown keys, and here that stripping is load-bearing rather than a
 * footgun: it is what stops a stranger POSTing `status=selected`,
 * `payment.status=verified`, `applicationId=...` or `verificationCode=...` and
 * having the service spread it onto the document. The schema is deliberately NOT
 * .strict(): a public form collects stray fields (a honeypot, a CAPTCHA token, a
 * password manager's autofill) and 400-ing a real applicant over a field we
 * chose to ignore is worse than dropping it.
 */

/** An optional free-text field. Blank ("I left this alone") reads as absent. */
const optionalText = (max) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

/**
 * An optional number from a text input.
 *
 * emptyToUndefined MUST run first. `z.coerce.number()` is `Number(v)`, and
 * `Number('')` is 0 — so an untouched "Year of passing" box would arrive as the
 * year 0 and be rejected by the model's `min: 1950` with an error about a value
 * the applicant never typed. Blank has to mean absent before coercion, not after.
 */
const optionalNumber = (min, max) =>
  z.preprocess(emptyToUndefined, z.coerce.number().min(min).max(max).optional());

/**
 * A link the applicant pastes (LinkedIn, portfolio).
 *
 * Parsed rather than regex-tested, and restricted to http(s), for the reason
 * applicationConfig's paymentUrl is: this string is rendered as an anchor in the
 * super admin's review panel, so `javascript:...` here is stored XSS submitted by
 * an anonymous stranger and executed by the highest-privileged user in the
 * system. A `startsWith('http')` test would also wave through `https://evil` and
 * anything else that merely begins with the right letters — the parse is the point.
 *
 * The bare-host spelling is accepted because "linkedin.com/in/asha" is what
 * people actually type; prepending https:// is a kindness that costs nothing,
 * and the parse still has the final say.
 */
const optionalUrl = (max) =>
  z.preprocess(
    (v) => {
      const s = emptyToUndefined(v);
      if (typeof s !== 'string') return s;
      return /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
    },
    z
      .string()
      .trim()
      .max(max)
      .refine((v) => {
        try {
          const u = new URL(v);
          return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
          return false;
        }
      }, 'Enter a full link starting with https://')
      .optional(),
  );

/**
 * Skills, however the form chose to send them.
 *
 * multipart has no array type, so this field legitimately arrives three ways: as
 * a repeated field (multer hands us an array), as a JSON string (the client
 * serialised a chip input), or as one plain string. All three are the same
 * intent and are normalised here rather than in the controller, so the model only
 * ever sees string[].
 *
 * The count cap is not tidiness. `skills` is an unbounded array on the model,
 * populated from the open internet: without a cap a single request can store a
 * hundred thousand entries, and the text index on it turns that into someone
 * else's problem at query time.
 */
const MAX_SKILLS = 50;
const skills = z.preprocess(
  (v) => {
    let raw = v;
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (!s) return undefined;
      if (s.startsWith('[')) {
        try {
          raw = JSON.parse(s);
        } catch {
          return undefined; // malformed JSON is "no skills", not a 400 on a nice-to-have
        }
      } else {
        // "React, Node.js, SQL" — the shape a plain text input produces. Skills
        // do not contain commas, so this split cannot corrupt a real value.
        raw = s.split(',');
      }
    }
    if (!Array.isArray(raw)) return undefined;
    const seen = new Set();
    const out = [];
    for (const item of raw) {
      if (typeof item !== 'string') continue;
      const skill = item.trim();
      // Case-insensitive de-dupe: 'React' and 'react' are one skill, and a chip
      // input that lets both through should not double the list.
      const key = skill.toLowerCase();
      if (!skill || seen.has(key)) continue;
      seen.add(key);
      out.push(skill);
    }
    return out.slice(0, MAX_SKILLS);
  },
  z.array(z.string().max(60, 'Each skill must be at most 60 characters.')).max(MAX_SKILLS).optional(),
);

/**
 * The declaration tick-box.
 *
 * NOT `z.coerce.boolean()`. That is `Boolean(v)`, and every non-empty string is
 * truthy — so the string 'false' coerces to TRUE. An applicant who did not accept
 * the declaration would be recorded as having accepted it, and the wording frozen
 * onto their record (Application.declaration.text) would become a documented lie
 * about a person who never agreed to it. That is the one field on this form where
 * a silent coercion is a misrepresentation rather than a bug, so the accepted
 * spellings are enumerated and everything else falls through to be refused by name.
 *
 * 'on' is included because that is what an HTML checkbox posts when ticked.
 */
const TRUTHY = new Set(['true', 'on', '1', 'yes']);
const declaration = z.preprocess(
  (v) => (typeof v === 'string' && TRUTHY.has(v.trim().toLowerCase()) ? true : v),
  z.literal(true, {
    // Covers both "sent false" and "not sent at all": the applicant's next action
    // is the same either way, and zod's own text for a literal mismatch
    // ("Invalid literal value, expected true") is aimed at whoever wrote this line.
    errorMap: () => ({
      message: 'Please tick the declaration to confirm your details are accurate before submitting.',
    }),
  }),
);

/**
 * Loose on purpose. This gates a form, not a dialer: it accepts the separators
 * people type (+91 98765-43210, (022) 1234 5678) and leaves the judgement of
 * whether a number is real to the human who calls it. A stricter pattern here
 * rejects the diaspora and the occasional landline for no gain.
 */
const phone = (label) =>
  z
    .string()
    .trim()
    .min(7, `Enter a valid ${label}.`)
    .max(20, `Enter a valid ${label}.`)
    .regex(/^[+()\-\s\d]+$/, `Enter a valid ${label} — digits only, with an optional country code.`);

export const applySchema = z
  .object({
    /* ── Personal ─────────────────────────────────────── */
    fullName: z.string().trim().min(2, 'Please enter your full name.').max(160),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
    mobile: phone('mobile number'),
    altMobile: z.preprocess(emptyToUndefined, phone('alternate mobile number').optional()),
    dob: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    // Free text, matching the model. The model's comment is the whole argument:
    // an enum here is a dropdown hardening into the domain.
    gender: optionalText(40),

    /* ── Address ──────────────────────────────────────── */
    address: optionalText(500),
    city: optionalText(120),
    state: optionalText(120),
    country: optionalText(120),
    pinCode: optionalText(20),

    /* ── Education ────────────────────────────────────── */
    highestQualification: optionalText(160),
    college: optionalText(200),
    // Bounds mirror the model's min/max so a typo is a 400 naming the field
    // rather than a mongoose ValidationError rendered as a bare "Validation failed".
    passingYear: optionalNumber(1950, 2100),

    /* ── Professional ─────────────────────────────────── */
    skills,
    experienceType: optionalEnum(EXPERIENCE_TYPE),
    totalExperienceYears: optionalNumber(0, 60),
    currentCompany: optionalText(200),
    currentJobTitle: optionalText(160),
    // Free text by decision: applications are platform-level and not tied to a Job.
    preferredJobRole: optionalText(160),
    preferredLanguage: optionalEnum(['en', 'hi']),
    // Strings on the model, not numbers — "12 LPA", "negotiable" are real answers.
    expectedSalary: optionalText(60),
    currentSalary: optionalText(60),
    noticePeriod: optionalText(60),
    linkedin: optionalUrl(300),
    portfolio: optionalUrl(300),

    /* ── Payment claim ────────────────────────────────── */
    // A CLAIM. The applicant typing a UTR is the only thing that ever reaches us
    // about the money — the Pay Now button is a one-way redirect. The service
    // turns a present reference into payment.status 'claimed' and nothing more;
    // `verified` is a human's word, never this field's.
    paymentReference: optionalText(120),

    /* ── Declaration ──────────────────────────────────── */
    declaration,
  })
  .superRefine((data, ctx) => {
    // "Experienced" is a claim with consequences — it is what the reviewer reads
    // to decide the interview's difficulty — so it has to come with the two facts
    // that make it checkable. Attached to the specific fields rather than the
    // form, so the client can highlight the inputs the applicant must actually fill.
    if (data.experienceType !== 'experienced') return;
    if (!data.currentCompany) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currentCompany'],
        message: 'Tell us your current (or most recent) employer.',
      });
    }
    if (!data.currentJobTitle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currentJobTitle'],
        message: 'Tell us your current (or most recent) job title.',
      });
    }
  });

/**
 * The QR target's path parameter.
 *
 * The code is `crypto.randomBytes(9).toString('base64url')` — 12 characters from
 * the base64url alphabet. Pinning the shape means a scanner that mangles the URL
 * gets a 400 naming the problem, and the handler never turns arbitrary path text
 * into a database query.
 */
export const verifyCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'That verification code does not look right — check the link or scan the QR code again.'),
});

export default { applySchema, verifyCodeSchema };
