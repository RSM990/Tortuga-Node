import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import type { SessionData } from 'express-session';
import type MongoStore from 'connect-mongodb-session';
import { apiRateLimit } from './middleware/rate-limit.js';
import { connectDB, isDBHealthy } from './db.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';
const MONGODB_URL = process.env.MONGO_URI as string;
const HEALTH_PATHS = new Set(['/healthz', '/api/healthz']);

const app = express();

// Trust proxy for ALB/CloudFront
app.set('trust proxy', isProd ? 1 : false);

// Health check endpoints (before anything else)
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: isDBHealthy() ? 'connected' : 'disconnected',
  });
};

app.get('/healthz', healthHandler);
app.get('/api/healthz', healthHandler);

// Initialize database connection (non-blocking)
connectDB().catch((err) => {
  console.error('❌ Database initialization failed:', err);
});

// CORS Configuration
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  try {
    const url = new URL(origin);
    return (
      url.hostname === 'tortugatest.com' ||
      url.hostname.endsWith('.tortugatest.com')
    );
  } catch {
    return false;
  }
};

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
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

// HTTPS redirect in production (skip health checks)
app.use((req, res, next) => {
  if (isProd && !HEALTH_PATHS.has(req.path) && !req.secure) {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
});

// Body parsers
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// Rate limiting (skip health checks)
app.use((req, res, next) => {
  if (HEALTH_PATHS.has(req.path)) {
    return next();
  }
  apiRateLimit(req, res, next);
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Session store setup
type StoreType = InstanceType<ReturnType<typeof MongoStore>>;
let sessionStore: StoreType | null = null;

(async () => {
  try {
    const connectMongo = (await import('connect-mongodb-session')).default;
    const MongoDBStore = connectMongo(session);

    sessionStore = new MongoDBStore({
      uri: MONGODB_URL,
      collection: 'sessions',
      connectionOptions: {
        serverSelectionTimeoutMS: 5000,
      },
    }) as StoreType;

    sessionStore.on('error', (error: Error) => {
      console.error('❌ Session store error:', error);
    });
  } catch (error) {
    console.error('❌ Failed to initialize session store:', error);
  }
})();

// Session middleware (skip health checks)
app.use((req, res, next) => {
  if (HEALTH_PATHS.has(req.path)) {
    return next();
  }

  if (!sessionStore) {
    console.warn('⚠️ Session store not available, skipping session middleware');
    return next();
  }
  const SESSION_SECRET = process.env.SESSION_SECRET;
  if (!SESSION_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET environment variable is required in production'
    );
  }
  session({
    secret: SESSION_SECRET || 'devsecret',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    proxy: isProd,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      domain: isProd ? '.tortugatest.com' : undefined,
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })(req, res, next);
});

// API Routes
import authRoutes from './routes/auth.js';
import movieRoutes from './routes/movies.js';
import leagueRoutes from './routes/leagues.js';
import seasonRoutes from './routes/seasons.js';
import studioRoutes from './routes/studios.js';
import ownershipRoutes from './routes/ownership.js';
import awardRoutes from './routes/awards.js';
import computeRoutes from './routes/compute.js';
import devRoutes from './routes/dev.js';
import { AppError } from './utils/errors.js';

app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/leagues', leagueRoutes);
app.use('/api/leagues/:leagueId/studios', studioRoutes);
app.use('/api/seasons', seasonRoutes);
app.use('/api/ownership', ownershipRoutes);
app.use('/api', awardRoutes);
app.use('/api', computeRoutes);
app.use('/api', devRoutes);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Tortuga API',
    timestamp: new Date().toISOString(),
  });
});

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist',
  });
});

// Global Error Handler
app.use(
  (
    err: Error | AppError,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('❌ Error:', err);

    // Handle AppError instances
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      });
    }

    // Handle other errors
    res.status(500).json({
      error: 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && {
        message: err.message,
        stack: err.stack,
      }),
    });
  }
);

export default app;
