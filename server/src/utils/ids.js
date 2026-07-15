import mongoose from 'mongoose';

/**
 * Cast an id to an ObjectId for use inside an aggregation pipeline.
 *
 * WHY THIS EXISTS: `find()` and friends cast strings to ObjectId automatically
 * from the schema, but `aggregate()` does NOT — a `$match` on a raw string id
 * silently matches nothing and returns an empty result rather than an error.
 * Since `req.companyId` is a String (see middleware/tenant.js), every aggregate
 * scoped to a tenant must pass it through here.
 *
 * @param {*} id
 * @returns {mongoose.Types.ObjectId|null} null when the id is absent/invalid,
 *   which `$match` treats as "no match" rather than throwing.
 */
export function toId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(String(id)) : null;
}

export default { toId };
