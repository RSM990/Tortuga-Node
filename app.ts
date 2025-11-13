import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { apiRateLimit } from './middleware/rate-limit.js';

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

// ⚡ CRITICAL: Health checks FIRST, before DB connection
// This ensures ALB can reach the instance even if DB is down
app.get('/healthz', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/api/healthz', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Now import DB (after health checks are defined)
// This way, if DB connection fails, health checks still work
import('./db.js').catch((err) => {
  console.error('❌ Database connection failed:', err);
  // Don't exit - let the app run with health checks working
  // This allows ALB to see the instance is "alive" even if DB is down
});

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
app.use(express.static(path.join(__dirname, 'public')));

// session (skip health) — connect-mongodb-session in ESM
// Wrap in try-catch to prevent session store errors from crashing the app
let store: any;
try {
  const connectMongo = (await import('connect-mongodb-session')).default;
  const MongoDBStore = connectMongo(session);
  store = new MongoDBStore({
    uri: MONGODB_URL,
    collection: 'sessions',
    connectionOptions: {
      serverSelectionTimeoutMS: 5000, // Fail fast if MongoDB is down
    },
  });

  store.on('error', (error: Error) => {
    console.error('❌ Session store error:', error);
    // Don't crash the app
  });
} catch (error) {
  console.error('❌ Failed to initialize session store:', error);
  // Continue without session store - app will still respond to health checks
}

app.use((req, res, next) => {
  if (HEALTH_PATHS.has(req.path)) return next();

  // Only use session middleware if store is initialized
  if (store) {
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
  } else {
    // No session store - skip session middleware
    console.warn('⚠️ Session middleware skipped - store not available');
    next();
  }
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
app.get('/', (_req, res) =>
  res.json({
    status: 'ok',
    message: 'Tortuga API',
    timestamp: new Date().toISOString(),
  })
);

// 404
app.use((_req, res) =>
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist',
  })
);

// Error handler
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('❌ Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }
);

export default app;
