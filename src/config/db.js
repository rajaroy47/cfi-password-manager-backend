const mongoose = require('mongoose');
const env = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(env.mongoUri, {
      autoIndex: true,
    });
    // eslint-disable-next-line no-console
    console.log(`[DB] Connected to MongoDB at ${maskUri(env.mongoUri)}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[DB] Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    // eslint-disable-next-line no-console
    console.warn('[DB] MongoDB disconnected');
  });
}

function maskUri(uri) {
  // Avoid printing credentials in logs
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//****:****@');
}

module.exports = connectDB;
