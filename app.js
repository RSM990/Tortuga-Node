// app.js (top of file)
const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const cookieParser = require('cookie-parser');
const { apiRateLimit } = require('./middleware/rate-limit');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const isProd = process.env.NODE_ENV === 'production';
const MONGODB_URL = process.env.MONGO_URI;

const app = express();

// ------------- MUST be first: trust proxy so req.secure is accurate behind ALB
app.set('trust proxy', isProd ? 1 : false);

// ------------- Define health paths once and early
const HEALTH_PATHS = new Set(['/healthz', '/api/healthz']);

// ------------- CORS first (safe defaults)
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowByRule = (origin) => {
  if (!origin) return true; // allow same-origin / curl
  if (allowedOrigins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.hostname === 'tortugatest.com') return true;
    if (url.hostname.endsWith('.tortugatest.com')) return true;
  } catch {}
  return false;
};

const corsOptions = {
  origin: (origin, cb) =>
    allowByRule(origin)
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
app.options('*', cors(corsOptions));

// ------------- Health endpoints BEFORE ANY redirect/rate-limit/session
app.get('/healthz', (_req, res) => res.status(200).send('OK'));
app.get('/api/healthz', (_req, res) => res.status(200).send('OK')); // covers path-based checks if you ever use them

// ------------- HTTPS redirect, but SKIP health checks
app.use((req, res, next) => {
  if (isProd && !HEALTH_PATHS.has(req.path) && !req.secure) {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
});

// ------------- Parsers
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(bodyParser.json());

// ------------- SKIP rate limit on health
app.use((req, res, next) =>
  HEALTH_PATHS.has(req.path) ? next() : apiRateLimit(req, res, next)
);

// ------------- Static
app.use(express.static(path.join(__dirname, 'public')));

// ------------- Session cookie tuned for cross-site, but SKIP health
const store = new MongoDBStore({ uri: MONGODB_URL, collection: 'sessions' });
app.use((req, res, next) => {
  if (HEALTH_PATHS.has(req.path)) return next();
  session({
    secret: process.env.SESSION_SECRET || 'devsecret',
    resave: false,
    saveUninitialized: false,
    store, // your Mongo store
    proxy: isProd, // REQUIRED for secure cookies behind a proxy
    cookie: {
      httpOnly: true,
      secure: isProd, // false in dev (http://localhost)
      sameSite: isProd ? 'none' : 'lax', // dev can be lax; prod must be 'none'
      domain: isProd ? '.tortugatest.com' : undefined, // DO NOT set a domain in dev
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })(req, res, next);
});

// ------------- Routes
const authRoutes = require('./routes/auth');
const movieRoutes = require('./routes/movies');
const leagueRoutes = require('./routes/league');
const testRoutes = require('./routes/test');

app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/league', leagueRoutes);
app.use('/api/test', testRoutes);

// Simple root
app.get('/', (_req, res) => res.send('OK'));

// ------------- 404
app.use((_req, res) => res.status(404).send('<h1>Page not found</h1>'));

// ------------- DB + listen
mongoose
  .connect(MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => app.listen(process.env.PORT || 3000))
  .catch((err) => console.log(err));
