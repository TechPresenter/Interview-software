/**
 * Rebuild the question/question-set text indexes with a language override.
 *
 * A MongoDB text index reads each document's `language` field as ITS OWN
 * language setting unless told otherwise. Both collections carry a `language`
 * field holding 'en' | 'hi' | 'bilingual', and MongoDB knows none of the latter
 * two — so every insert of a Hindi or bilingual question was rejected outright:
 *
 *   MongoBulkWriteError: language override unsupported: bilingual (code 17262)
 *
 * The models now pin `language_override` to a field nobody writes, but index
 * OPTIONS cannot be changed in place: Mongo rejects a redefinition with
 * IndexOptionsConflict, so the old index has to go before the new one can be
 * built. Dropping a text index is safe — only $text search uses it, and it is
 * rebuilt on the next boot (autoIndex) or by this script.
 *
 *   node src/scripts/migrate-text-indexes.js          # apply
 *   node src/scripts/migrate-text-indexes.js --dry    # report only
 */
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { Question } from '../models/Question.js';
import { QuestionSet } from '../models/QuestionSet.js';

const DRY = process.argv.includes('--dry');

/** The field the models now point `language_override` at. */
const WANTED_OVERRIDE = 'textSearchLanguage';

async function fix(model, label) {
  const coll = model.collection;
  const indexes = await coll.indexes();
  const text = indexes.find((i) => i.textIndexVersion);

  if (!text) {
    logger.info(`${label}: no text index yet — it will be built with the right options`);
    return false;
  }
  // Absent means the default, which is the broken case: the literal field `language`.
  const current = text.language_override ?? 'language';
  if (current === WANTED_OVERRIDE) {
    logger.info(`${label}: already overridden to "${WANTED_OVERRIDE}" — nothing to do`);
    return false;
  }

  logger.info(`${label}: text index "${text.name}" reads the document's "${current}" field as its language`);
  if (DRY) {
    logger.info(`  would drop "${text.name}" and rebuild with language_override="${WANTED_OVERRIDE}"`);
    return false;
  }
  await coll.dropIndex(text.name);
  await model.syncIndexes();
  logger.info(`  ✅ rebuilt with language_override="${WANTED_OVERRIDE}"`);
  return true;
}

async function run() {
  await mongoose.connect(config.mongoUri);
  logger.info('Connected to MongoDB');

  let changed = 0;
  if (await fix(Question, 'questions')) changed += 1;
  if (await fix(QuestionSet, 'questionsets')) changed += 1;

  if (!DRY) {
    // Prove it: the two values that could not be written before.
    for (const language of ['hi', 'bilingual']) {
      const probe = await Question.create({
        company: null, text: `index probe ${language}`, type: 'technical', difficulty: 'medium', language,
      });
      await Question.deleteOne({ _id: probe._id });
      logger.info(`  verified: a "${language}" question saves`);
    }
  }
  logger.info(DRY ? 'Dry run: nothing written.' : `✅ Done — ${changed} index(es) rebuilt.`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  logger.error({ err }, 'Text index migration failed');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
