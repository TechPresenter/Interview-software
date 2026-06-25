/**
 * Helpers for list endpoints: pagination, sorting, and text search → executed as
 * a single efficient query with a parallel count.
 */

/**
 * Parse standard list query params.
 * @param {object} query req.query
 * @param {object} [opts]
 * @param {string[]} [opts.searchFields] fields to OR-match against `q`
 * @param {string} [opts.defaultSort] e.g. '-createdAt'
 */
export function parseListQuery(query = {}, { searchFields = [], defaultSort = '-createdAt' } = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  const sort = query.sort || defaultSort;

  const filter = {};
  if (query.q && searchFields.length) {
    const rx = new RegExp(escapeRegex(String(query.q)), 'i');
    filter.$or = searchFields.map((f) => ({ [f]: rx }));
  }
  return { page, limit, skip, sort, filter };
}

/**
 * Run a paginated find on a model and return { items, meta }.
 * @param {import('mongoose').Model} model
 */
export async function paginateQuery(model, baseFilter, { page, limit, skip, sort }, populate) {
  let q = model.find(baseFilter).sort(sort).skip(skip).limit(limit);
  if (populate) q = q.populate(populate);
  const [items, total] = await Promise.all([q.lean(), model.countDocuments(baseFilter)]);
  return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 } };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
