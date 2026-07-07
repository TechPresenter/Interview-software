import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Validates and normalizes environment variables once at boot.
 * Fails fast with a readable error if required config is missing.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_PREFIX: z.string().default('/api/v1'),
  CLIENT_URL: z.string().url().default('http://localhost:3000'),
  API_PUBLIC_URL: z.string().optional(), // public API base for email tracking links

  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be >= 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be >= 16 chars'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().default('claude-opus-4-8'),
  AI_MODEL_FAST: z.string().default('claude-haiku-4-5-20251001'),
  AI_MAX_TOKENS: z.coerce.number().default(4096),
  AI_ENCRYPTION_KEY: z.string().optional(), // encrypts stored provider API keys

  // Sarvam AI — natural Indian-language TTS for the interview room (Hindi/English).
  SARVAM_API_KEY: z.string().optional(),
  SARVAM_TTS_MODEL: z.string().default('bulbul:v2'),
  SARVAM_SPEAKER_FEMALE: z.string().default('anushka'),
  SARVAM_SPEAKER_MALE: z.string().default('abhilash'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('AIPL Hire <support@aipl.online>'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  CASHFREE_APP_ID: z.string().optional(),
  CASHFREE_SECRET_KEY: z.string().optional(),
  CASHFREE_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  CASHFREE_WEBHOOK_SECRET: z.string().optional(),

  SMS_PROVIDER: z.string().optional(), // e.g. 'twilio'
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),

  SENTRY_DSN: z.string().optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  port: env.PORT,
  apiPrefix: env.API_PREFIX,
  clientUrl: env.CLIENT_URL,
  apiPublicUrl: env.API_PUBLIC_URL,
  mongoUri: env.MONGO_URI,
  redisUrl: env.REDIS_URL,
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpires: env.JWT_ACCESS_EXPIRES,
    refreshExpires: env.JWT_REFRESH_EXPIRES,
  },
  ai: {
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.AI_MODEL,
    modelFast: env.AI_MODEL_FAST,
    maxTokens: env.AI_MAX_TOKENS,
    enabled: Boolean(env.ANTHROPIC_API_KEY),
    encryptionKey: env.AI_ENCRYPTION_KEY,
  },
  voice: {
    sarvam: {
      apiKey: env.SARVAM_API_KEY,
      model: env.SARVAM_TTS_MODEL,
      speakerFemale: env.SARVAM_SPEAKER_FEMALE,
      speakerMale: env.SARVAM_SPEAKER_MALE,
      enabled: Boolean(env.SARVAM_API_KEY),
    },
  },
  mail: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.MAIL_FROM,
    enabled: Boolean(env.SMTP_HOST),
  },
  payments: {
    stripe: {
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      enabled: Boolean(env.STRIPE_SECRET_KEY),
    },
    razorpay: {
      keyId: env.RAZORPAY_KEY_ID,
      keySecret: env.RAZORPAY_KEY_SECRET,
      enabled: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
    },
    cashfree: {
      appId: env.CASHFREE_APP_ID,
      secretKey: env.CASHFREE_SECRET_KEY,
      mode: env.CASHFREE_ENV,
      webhookSecret: env.CASHFREE_WEBHOOK_SECRET,
      enabled: Boolean(env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY),
    },
  },
  sms: {
    provider: env.SMS_PROVIDER,
    twilio: {
      sid: env.TWILIO_ACCOUNT_SID,
      token: env.TWILIO_AUTH_TOKEN,
      from: env.TWILIO_FROM,
      whatsappFrom: env.TWILIO_WHATSAPP_FROM,
    },
    enabled: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN),
  },
  oauth: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      enabled: Boolean(env.GOOGLE_CLIENT_ID),
    },
    linkedin: {
      clientId: env.LINKEDIN_CLIENT_ID,
      clientSecret: env.LINKEDIN_CLIENT_SECRET,
      enabled: Boolean(env.LINKEDIN_CLIENT_ID),
    },
  },
  sentry: { dsn: env.SENTRY_DSN, enabled: Boolean(env.SENTRY_DSN) },
  rateLimit: { windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX },
  bcryptRounds: env.BCRYPT_ROUNDS,
};

export default config;
