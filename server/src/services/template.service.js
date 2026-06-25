import { Template } from '../models/Template.js';

/** Replace {{var}} placeholders with values (missing vars render as ''). */
export function interpolate(str, vars = {}) {
  return String(str || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const val = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), vars);
    return val == null ? '' : String(val);
  });
}

/**
 * Render a stored template by key. Returns { subject, body } with variables
 * substituted, or null if the template is missing/inactive.
 */
export async function render(key, vars = {}) {
  const tpl = await Template.findOne({ key, isActive: true }).lean();
  if (!tpl) return null;
  return {
    channel: tpl.channel,
    subject: interpolate(tpl.subject, vars),
    body: interpolate(tpl.body, vars),
  };
}

export default { render, interpolate };
