const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Set required env vars BEFORE any app module (which validates env on require) loads.
process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
// Placeholder only — env.js validates that MONGODB_URI is non-empty the
// moment app.js is required (before beforeAll below has a chance to run),
// but the actual connection always uses the real in-memory server URI
// assigned below, so this value is never dialed.
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://placeholder-until-beforeall:27017/test';
process.env.JWT_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex');
process.env.CORS_ORIGIN = 'http://localhost:5173';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
