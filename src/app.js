require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');

const env = require('./config/env');
const { sanitizeBody } = require('./middleware/validate');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const credentialRoutes = require('./routes/credentialRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const searchRoutes = require('./routes/searchRoutes');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // needed for correct req.ip behind a LAN reverse proxy, if used

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Non-browser requests (health checks, curl, internal services).
      if (!origin) return callback(null, true);

      // Allow the configured admin dashboard origins.
      if (env.corsOrigin.includes(origin)) return callback(null, true);

      // Chrome extension requests carry a chrome-extension:// Origin.
      // The extension is authenticated with its own JWT and can only reach
      // this company's API because host_permissions are scoped to the API.
      if (/^chrome-extension:\/\/[a-z]{32}$/i.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error('CORS origin not allowed'));
    },
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize()); // strips $ and . operators from req.body/query/params
app.use(sanitizeBody);
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/search', searchRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
