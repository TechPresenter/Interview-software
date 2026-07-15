/**
 * Seed the eight built-in AI prompts into PromptTemplate.
 *
 * The engines fall back to defaults.js when a key has no active row, so seeding
 * is not required to keep interviews running — it exists so the admin panel has
 * real, editable text to show instead of a placeholder.
 *
 * Idempotent, and deliberately conservative on re-runs: an existing built-in row
 * has its METADATA refreshed (name, description, variables) but never its body.
 * Re-running must not silently discard an admin's edit — that is what
 * `resetToDefault` is for, where it is explicit and versioned.
 *
 * Legacy overrides: `ai.prompt.<key>` in SystemSetting used to hold a system
 * override that applyPromptOverride honoured. Seeding an active row would shadow
 * it, silently reverting a tuned prompt to the built-in, so any legacy `system`
 * is carried into the new row. A legacy `template` is reported but NOT carried:
 * that field was required by the old API and then ignored at runtime, so the
 * stored text has never been sent to a model and must be reviewed before it can
 * be — see the note in prompts/index.js.
 *
 *   node src/scripts/seed-prompts.js          # apply
 *   node src/scripts/seed-prompts.js --dry    # report only
 */
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { PromptTemplate } from '../models/PromptTemplate.js';
import { SystemSetting } from '../models/SystemSetting.js';
import { DEFAULT_PROMPTS, PROMPT_KEYS } from '../services/ai/prompts/defaults.js';

const DRY = process.argv.includes('--dry');

async function run() {
  await mongoose.connect(config.mongoUri);
  logger.info('Connected to MongoDB');

  let createdCount = 0;
  let refreshed = 0;
  let migrated = 0;

  for (const key of PROMPT_KEYS) {
    const def = DEFAULT_PROMPTS[key];
    const existing = await PromptTemplate.findOne({ key, isBuiltIn: true });

    if (existing) {
      if (DRY) {
        logger.info(`  would refresh metadata for built-in "${key}" (body untouched)`);
      } else {
        existing.name = def.name;
        existing.description = def.description;
        existing.category = def.category;
        existing.variables = def.variables;
        await existing.save();
      }
      refreshed += 1;
      continue;
    }

    // Read SystemSetting directly rather than via settings.service: the service
    // reads through Redis, which a one-shot script has no reason to require.
    const legacy = await SystemSetting.findOne({ key: `ai.prompt.${key}` }).lean();
    const legacySystem = legacy?.value?.system;
    if (legacy?.value?.template) {
      logger.warn(`  "${key}" has a legacy template body stored; NOT migrated (it has never been live). Review it in the panel before activating.`);
    }
    if (legacySystem) migrated += 1;

    const hasActive = await PromptTemplate.exists({ key, isActive: true });
    if (DRY) {
      logger.info(`  would create built-in "${key}"${legacySystem ? ' (carrying the legacy system override)' : ''}${hasActive ? ' (inactive — another template is already live)' : ' (active)'}`);
      createdCount += 1;
      continue;
    }

    await PromptTemplate.create({
      key,
      name: def.name,
      description: def.description,
      category: def.category,
      system: legacySystem || def.system,
      template: def.template,
      variables: def.variables,
      isBuiltIn: true,
      // Never contend with a template an admin already activated for this key —
      // the partial unique index would reject it, and stealing the slot would be
      // worse than being rejected.
      isActive: !hasActive,
    });
    createdCount += 1;
  }

  if (DRY) logger.info('Dry run: nothing written.');
  else logger.info(`✅ Prompts seeded: ${createdCount} created, ${refreshed} refreshed, ${migrated} legacy override(s) carried over`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  logger.error({ err }, 'Prompt seeding failed');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
