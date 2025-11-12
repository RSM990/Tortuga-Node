import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { apiRateLimit } from './middleware/rate-limit.js';
import './db.js';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

// __dirname replacement for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';
const MONGODB_URL = process.env.MONGO_URI as string;

const app = express();

// trust proxy so req.secure is accurate behind ALB
app.set('trust proxy', isProd ? 1 : false);

// health paths
const HEALTH_PATHS = new Set(['/healthz', '/api/healthz']);

// CORS
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowByRule = (origin?: string) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.hostname === 'tortugatest.com') return true;
    if (url.hostname.endsWith('.tortugatest.com')) return true;
  } catch {}
  return false;
};

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) =>
    allowByRule(origin || undefined)
      ? cb(null, true)
      : cb(new Error(`CORS blocked: ${origin}`)),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-XSRF-TOKEN',
  ],
  credentials: true,
};

app.use(cors(corsOptions));
// Express 5 + path-to-regexp v6: avoid bare "*" wildcards
// app.options('(.*)', cors(corsOptions)); // optional; usually unnecessary if the middleware above is present

// Health BEFORE redirects/limits/sessions
app.get('/healthz', (_req, res) => res.status(200).send('OK'));
app.get('/api/healthz', (_req, res) => res.status(200).send('OK'));

// HTTPS redirect (skip health)
app.use((req, res, next) => {
  if (isProd && !HEALTH_PATHS.has(req.path) && !req.secure) {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
});

// parsers
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// rate limit (skip health)
app.use((req, res, next) =>
  HEALTH_PATHS.has(req.path) ? next() : apiRateLimit(req, res, next)
);

// static
app.use(express.static(path.join(__dirname, '../public')));

// session (skip health) — connect-mongodb-session in ESM
import connectMongo from 'connect-mongodb-session';
const MongoDBStore = connectMongo(session);
const store = new MongoDBStore({ uri: MONGODB_URL, collection: 'sessions' });

app.use((req, res, next) => {
  if (HEALTH_PATHS.has(req.path)) return next();
  session({
    secret: process.env.SESSION_SECRET || 'devsecret',
    resave: false,
    saveUninitialized: false,
    store,
    proxy: isProd,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      domain: isProd ? '.tortugatest.com' : undefined,
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })(req, res, next);
});

// routes (convert your route files to ESM/TS and export default)
import authRoutes from './routes/auth.js';
import movieRoutes from './routes/movies.js';

import leagues from './routes/leagues.js';
import seasons from './routes/seasons.js';
import studios from './routes/studios.js';
import ownership from './routes/ownership.js';
import awards from './routes/awards.js';
import compute from './routes/compute.js';
import testRoutes from './routes/test.js';
import devRoutes from './routes/dev.js';
import studioRoutes from './routes/studios.js';

app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);

app.use('/api/leagues', leagues);
app.use('/api/seasons', seasons);
app.use('/api/studios', studios);
app.use('/api/ownership', ownership);
app.use('/api', awards);
app.use('/api', compute);
app.use('/api', studioRoutes); // Routes already include /leagues/:id prefix
app.use('/api/test', testRoutes);
app.use('/api', devRoutes);

// root
app.get('/', (_req, res) => res.send('OK'));

// 404
app.use((_req, res) => res.status(404).send('<h1>Page not found</h1>'));

export default app;
