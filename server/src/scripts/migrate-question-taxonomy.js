/**
 * One-shot migration: split the old conflated `Question.category` into
 * `type` (format) + `category` (industry).
 *
 * The legacy `category` enum was ['technical','hr','aptitude','behavioral',
 * 'coding','custom'] — every one of those is a question FORMAT, not an
 * industry. So we copy the value into the new `type` field and clear
 * `category`, leaving it free to hold a real industry. Widening `category` in
 * place would have mis-filed every existing document.
 *
 * Idempotent: only touches docs whose `category` still holds a legacy value.
 * Uses updateMany with the aggregation pipeline form so `type` is set from the
 * doc's own `category` in a single server-side pass (no cursor, no validators
 * to fight).
 *
 *   node src/scripts/migrate-question-taxonomy.js          # apply
 *   node src/scripts/migrate-question-taxonomy.js --dry    # report only
 */
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { Question } from '../models/Question.js';
import { QUESTION_CATEGORIES } from '../constants/enums.js';

const DRY = process.argv.includes('--dry');

async function run() {
  await mongoose.connect(config.mongoUri);
  logger.info('Connected to MongoDB');

  // Docs still carrying a legacy value in `category`.
  const filter = { category: { $in: QUESTION_CATEGORIES } };
  const pending = await Question.countDocuments(filter);
  const total = await Question.countDocuments({});
  logger.info(`${pending} of ${total} question(s) need the taxonomy split`);

  if (DRY) {
    const sample = await Question.find(filter).select('category type text').limit(5).lean();
    for (const q of sample) {
      logger.info(`  would set type='${q.category}', category=null  —  "${String(q.text).slice(0, 60)}…"`);
    }
    logger.info('Dry run: nothing written.');
  } else if (pending > 0) {
    const res = await Question.collection.updateMany(filter, [
      { $set: { type: '$category', category: null } },
    ]);
    logger.info(`✅ Migrated ${res.modifiedCount} question(s): category → type`);
  } else {
    logger.info('✅ Nothing to migrate (already applied).');
  }

  // Backfill defaults the new schema expects on pre-existing docs.
  if (!DRY) {
    const defaults = await Question.collection.updateMany(
      { status: { $exists: false } },
      { $set: { status: 'approved', source: 'manual', language: 'en', isPublic: true } },
    );
    if (defaults.modifiedCount) logger.info(`✅ Backfilled status/source/language on ${defaults.modifiedCount} doc(s)`);
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  logger.error({ err }, 'Migration failed');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
