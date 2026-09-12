const env = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  // Never leak stack traces or internal details in production responses.
  const body = {
    error: {
      message: err.isOperational ? err.message : 'Internal server error',
      ...(err.details ? { details: err.details } : {}),
    },
  };

  if (env.nodeEnv !== 'production' && !err.isOperational) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(statusCode).json(body);
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });
}

module.exports = { errorHandler, notFoundHandler };
