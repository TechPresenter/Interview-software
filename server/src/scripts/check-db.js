/**
 * Quick read-only connectivity check for MongoDB + Redis using your .env config.
 * Run on a machine with internet:  npm run check:db
 */
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { redis } from '../config/redis.js';

async function main() {
  let ok = true;

  // MongoDB
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 12000 });
    console.log(`✅ MongoDB connected — db: ${mongoose.connection.name}`);
    await mongoose.connection.close();
  } catch (e) {
    ok = false;
    console.error(`❌ MongoDB failed: ${e.message}`);
  }

  // Redis
  try {
    const pong = await redis.ping();
    console.log(`✅ Redis connected — ${pong}`);
  } catch (e) {
    ok = false;
    console.error(`❌ Redis failed: ${e.message}`);
  }
  await redis.quit().catch(() => {});

  process.exit(ok ? 0 : 1);
}

main();
