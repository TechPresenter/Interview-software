/**
 * Standard success envelope so every endpoint returns a predictable shape:
 * { success, message, data, meta }.
 */
export function ok(res, data = null, message = 'OK', meta = undefined) {
  return res.status(200).json({ success: true, message, data, meta });
}

export function created(res, data = null, message = 'Created') {
  return res.status(201).json({ success: true, message, data });
}

export function noContent(res) {
  return res.status(204).send();
}

/** Build a pagination meta object from query + total count. */
export function paginate({ page = 1, limit = 20, total = 0 }) {
  const p = Number(page);
  const l = Number(limit);
  return { page: p, limit: l, total, pages: Math.ceil(total / l) || 1 };
}

export default { ok, created, noContent, paginate };
