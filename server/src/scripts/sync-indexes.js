/**
 * Build any missing MongoDB indexes. Run on deploy.
 *
 * config/db.js sets `autoIndex: !config.isProd` — deliberately, because letting
 * every booting process race to build indexes against a live collection is how
 * you stall production. The consequence is that a new index declared in a schema
 * DOES NOT EXIST on the server until something creates it, and nothing does.
 *
 * That failure is silent and it is not cosmetic. Application declares partial
 * unique indexes on email/mobile that enforce "one live application per person"
 * across concurrent submits — the service's findOne() check catches the ordinary
 * case, but only the index catches two submits racing. Without this script the
 * rule looks enforced, passes a casual test, and quietly is not.
 *
 * createIndexes(), never syncIndexes(): sync DROPS anything not declared in the
 * schema, which on a live database means dropping an index someone added by hand
 * to rescue a slow query. This only ever adds.
 *
 * Idempotent — an existing index is left alone. Safe to run on every deploy.
 *
 *   node src/scripts/sync-indexes.js         # build
 *   node src/scripts/sync-indexes.js --dry   # report only
 */
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

// Importing the barrel registers every model on the mongoose singleton, which is
// what makes `mongoose.models` complete. Miss one and its indexes never build.
import '../models/index.js';

const DRY = process.argv.includes('--dry');

/** Index names that exist on the collection right now. */
async function existing(model) {
  try {
    return new Set((await model.collection.indexes()).map((i) => i.name));
  } catch (err) {
    // Code 26 = NamespaceNotFound: the collection has never been written to, so
    // every declared index is missing rather than this being an error.
    if (err?.code === 26) return new Set();
    throw err;
  }
}

/** Describe an index spec the way a person reads it: { company: 1, email: 1 } → company_1_email_1 */
const describe = (spec) => Object.entries(spec).map(([k, v]) => `${k}_${v}`).join('_');

async function run() {
  await mongoose.connect(config.mongoUri);
  logger.info(`Connected — checking indexes for ${Object.keys(mongoose.models).length} models`);

  let created = 0;
  let already = 0;
  const failures = [];

  for (const [name, model] of Object.entries(mongoose.models)) {
    if (!model.schema.indexes().length) continue;

    if (DRY) {
      // diffIndexes() asks the database rather than guessing from the schema.
      // The obvious alternative — compare declared `name` options — reports
      // nothing useful, because mongoose auto-names almost every index and the
      // schema never sees the name it will get.
      const { toCreate, toDrop } = await model.diffIndexes();
      if (toCreate.length) logger.info(`${name}: would build ${toCreate.map(describe).join(', ')}`);
      // Reported, never acted on: this script does not drop. An index the schema
      // no longer declares is usually one someone added by hand to rescue a slow
      // query, and losing it silently is worse than carrying it.
      if (toDrop.length) logger.info(`${name}: ${toDrop.length} index(es) exist that the schema no longer declares (left alone)`);
      if (!toCreate.length && !toDrop.length) already += 1;
      continue;
    }

    const before = await existing(model);
    try {
      await model.createIndexes();
      const added = [...(await existing(model))].filter((n) => !before.has(n));
      if (added.length) {
        created += added.length;
        logger.info(`${name}: built ${added.join(', ')}`);
      } else {
        already += 1;
      }
    } catch (err) {
      // One bad model must not stop the rest: a duplicate-key error here means
      // the data already violates a newly-declared unique index, which is a real
      // thing to fix but not a reason to leave every other collection unindexed.
      failures.push({ name, message: err.message });
      logger.error({ err: err.message }, `${name}: index build FAILED`);
    }
  }

  if (DRY) {
    logger.info(`Dry run — nothing written. ${already} model(s) already current.`);
  } else {
    logger.info(`Done — ${created} index(es) built, ${already} model(s) already current.`);
  }

  if (failures.length) {
    logger.error(`${failures.length} model(s) failed: ${failures.map((f) => f.name).join(', ')}`);
    // Exit non-zero so a deploy pipeline notices. The most likely cause is real:
    // existing rows that violate a newly-declared unique index.
    await mongoose.disconnect();
    process.exit(1);
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  logger.error({ err }, 'Index sync failed');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
