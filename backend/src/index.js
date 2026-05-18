require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes     = require('./routes/auth');
const coverageRoutes = require('./routes/coverage');
const stormRoutes    = require('./routes/storms');
const adminRoutes    = require('./routes/admin');
const { startStormChecker }   = require('./jobs/stormChecker');
const { startForecastChecker } = require('./jobs/forecastChecker');

const app  = express();
const PORT = process.env.PORT || 3001;

// Trust one hop of proxy headers (Railway, Render, etc.) for correct IP detection
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10kb' }));

// Global rate limit — 200 req / 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(globalLimiter);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

app.use('/api/auth',           authRoutes);
app.use('/api/coverage-zones', coverageRoutes);
app.use('/api/storms',         stormRoutes);
app.use('/api/admin',          adminRoutes);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Storm Alert API → http://localhost:${PORT}`);
  startStormChecker();
  startForecastChecker();
});
