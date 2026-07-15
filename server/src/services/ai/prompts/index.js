/**
 * Prompt entry point for the AI engines.
 *
 * The bodies now live in defaults.js as {{placeholder}} strings, and the
 * super-admin's edits live in the PromptTemplate collection — see
 * services/ai/prompt.service.js for how one is chosen over the other. This module
 * stays for the call sites: `prompts` and `applyPromptOverride` keep the shapes
 * the engines already spread into complete()/completeJson().
 *
 * `prompts.<key>(input)` renders the built-in and carries `input` along so
 * applyPromptOverride can re-render the same arguments against a stored template
 * without every engine having to change. The extra key is inert: complete()
 * destructures the options it wants and ignores the rest. Rendering the built-in
 * that an override then discards costs one string interpolation, which is the
 * price of not touching six call sites.
 */

import { getSetting } from '../../settings.service.js';
import { interpolate } from '../../template.service.js';
import { renderPrompt, getActiveTemplate } from '../prompt.service.js';
import { DEFAULT_PROMPTS, PROMPT_KEYS } from './defaults.js';

const buildDefault = (key, input) => {
  const def = DEFAULT_PROMPTS[key];
  const flat = def.vars(input || {});
  return {
    system: interpolate(def.system, flat),
    messages: [{ role: 'user', content: interpolate(def.template, flat) }],
    input,
  };
};

/**
 * The built-in prompts, keyed by engine hook. Each takes the named arguments
 * documented against its key in defaults.js.
 */
export const prompts = Object.fromEntries(
  PROMPT_KEYS.map((key) => [key, (input = {}) => buildDefault(key, input)]),
);

/**
 * Apply the super-admin's prompt override to a built prompt.
 *
 * Resolution order:
 *  1. the active PromptTemplate row — both `system` AND the message body, which
 *     is the point: the panel used to save a `template` that runtime discarded,
 *     so an admin's edit changed nothing and failed silently;
 *  2. a legacy `ai.prompt.<key>` SystemSetting override — system only;
 *  3. the built-in.
 *
 * Step 2's system-only limit is deliberate, not an oversight. Those records were
 * written when the panel REQUIRED a `template` it then ignored, so the stored
 * bodies are dormant text nobody has ever seen sent — often the literal
 * "(uses built-in template — see services/ai/prompts)" the old endpoint echoed
 * back. Arming them here would silently push unreviewed text into live scoring,
 * where a body missing its JSON contract scores every candidate 0. They are
 * migrated deliberately by scripts/seed-prompts.js instead, where they can be
 * previewed. Never throws: a settings read must not break scoring.
 *
 * @param {string} key one of the keys in `prompts`
 * @param {{system: string, messages: object[], input?: object}} built the default built prompt
 */
export async function applyPromptOverride(key, built) {
  try {
    if (await getActiveTemplate(key)) {
      return { ...built, ...(await renderPrompt(key, built?.input || {})) };
    }
    const legacy = await getSetting(`ai.prompt.${key}`, null);
    if (legacy?.system) return { ...built, system: legacy.system };
  } catch {
    /* fall back to the default prompt */
  }
  return built;
}

export { DEFAULT_PROMPTS, PROMPT_KEYS };
export default prompts;
