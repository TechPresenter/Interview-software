// Provide the minimum env so config/index.js validates without a real .env.
// Runs before each test file's imports are evaluated.
process.env.NODE_ENV = 'test';
process.env.MONGO_URI ||= 'mongodb://localhost:27017/hiresense-test';
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-0123456789';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-0123456789';
