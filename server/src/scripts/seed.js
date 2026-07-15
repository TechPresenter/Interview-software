/**
 * Idempotent seed: creates the first super-admin and a couple of sample global
 * questions so a fresh install is immediately usable.
 *
 *   SUPER_ADMIN_EMAIL=admin@hiresense.ai SUPER_ADMIN_PASSWORD=ChangeMe123! npm run seed
 */
import { connectDB, disconnectDB } from '../config/db.js';
import { logger } from '../config/logger.js';
import { User } from '../models/User.js';
import { Question } from '../models/Question.js';
import { Plan } from '../models/Plan.js';
import { ROLES } from '../constants/enums.js';

async function run() {
  await connectDB();

  const email = (process.env.SUPER_ADMIN_EMAIL || 'admin@hiresense.ai').toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!';

  let admin = await User.findOne({ email });
  if (!admin) {
    admin = await User.create({
      name: 'Super Admin',
      email,
      password,
      role: ROLES.SUPER_ADMIN,
      isEmailVerified: true,
    });
    logger.info(`✅ Created super admin: ${email}`);
  } else {
    logger.info(`ℹ️  Super admin already exists: ${email}`);
  }

  // Upsert plans to the current defaults so re-running keeps pricing/features in sync.
  await Plan.bulkWrite(
    Plan.defaults().map((p) => ({ updateOne: { filter: { key: p.key }, update: { $set: p }, upsert: true } })),
  );
  logger.info('✅ Synced subscription plans');

  const sampleCount = await Question.countDocuments({ company: null });
  if (sampleCount === 0) {
    await Question.insertMany([
      // `type` = format, `category` = industry. insertMany bypasses the zod
      // validator, so these must be schema-valid by hand.
      {
        type: 'technical',
        category: 'software_development',
        topic: 'Databases',
        difficulty: 'medium',
        text: 'Explain the difference between SQL and NoSQL databases and when you would choose each.',
        skills: ['databases', 'system-design'],
        competencies: ['technical', 'communication'],
        expectedPoints: [
          'SQL enforces a fixed schema with ACID guarantees; NoSQL trades some of that for flexibility',
          'Relational joins vs denormalised/embedded documents',
          'Horizontal scaling and sharding characteristics of each',
          'A concrete workload where each is the better fit',
        ],
        createdBy: admin._id,
      },
      {
        type: 'behavioral',
        category: 'software_development',
        topic: 'Teamwork',
        difficulty: 'easy',
        text: 'Tell me about a time you handled a disagreement within your team.',
        competencies: ['behavioral', 'communication', 'leadership'],
        expectedPoints: [
          'Describes a specific situation rather than a hypothetical',
          'Explains their own actions, not just the team’s',
          'Shows the resolution and what they learned',
        ],
        createdBy: admin._id,
      },
      {
        type: 'coding',
        category: 'software_development',
        topic: 'Algorithms',
        difficulty: 'medium',
        text: 'Write a function that returns the first non-repeating character in a string.',
        skills: ['algorithms', 'javascript'],
        competencies: ['technical', 'problemSolving'],
        expectedPoints: [
          'Counts occurrences in one pass, then scans for the first with count 1',
          'Achieves O(n) time rather than a nested O(n²) scan',
          'Handles the no-unique-character case',
        ],
        coding: { language: 'javascript', starterCode: 'function firstUnique(s) {\n  // ...\n}' },
        createdBy: admin._id,
      },
    ]);
    logger.info('✅ Seeded sample global questions');
  }

  await disconnectDB();
  process.exit(0);
}

run().catch((err) => {
  logger.fatal({ err }, 'Seed failed');
  process.exit(1);
});
