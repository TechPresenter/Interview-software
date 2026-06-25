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

  const planCount = await Plan.countDocuments();
  if (planCount === 0) {
    await Plan.insertMany(Plan.defaults());
    logger.info('✅ Seeded subscription plans');
  }

  const sampleCount = await Question.countDocuments({ company: null });
  if (sampleCount === 0) {
    await Question.insertMany([
      {
        category: 'technical',
        difficulty: 'medium',
        text: 'Explain the difference between SQL and NoSQL databases and when you would choose each.',
        skills: ['databases', 'system-design'],
        competencies: ['technical', 'communication'],
        createdBy: admin._id,
      },
      {
        category: 'behavioral',
        difficulty: 'easy',
        text: 'Tell me about a time you handled a disagreement within your team.',
        competencies: ['behavioral', 'communication', 'leadership'],
        createdBy: admin._id,
      },
      {
        category: 'coding',
        difficulty: 'medium',
        text: 'Write a function that returns the first non-repeating character in a string.',
        skills: ['algorithms', 'javascript'],
        competencies: ['technical', 'problemSolving'],
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
