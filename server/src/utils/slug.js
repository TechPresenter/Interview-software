import { nanoid } from 'nanoid';

/** URL-safe slug from a name, with a short random suffix to guarantee uniqueness. */
export const slugify = (s) =>
  `${String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)}-${nanoid(6)}`;

export default slugify;
