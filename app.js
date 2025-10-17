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

const MONGODB_URL = process.env.MONGO_URI;

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);

const isProd = process.env.NODE_ENV === 'production';
// In prod behind a single proxy/load balancer (ALB/NGINX/Heroku), trust 1 hop.
// In local dev, don't trust proxies.
app.set('trust proxy', isProd ? 1 : false);

app.use((req, res, next) => {
  // Check if the environment is production
  if (isProd) {
    // Only redirect if the connection is not secure (HTTP)
    if (!req.secure) {
      return res.redirect('https://' + req.headers.host + req.url); // Redirect to HTTPS
    }
  }
  next();
});

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(bodyParser.json());

app.use(apiRateLimit);

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

const authRoutes = require('./routes/auth');
const movieRoutes = require('./routes/movies');
const leagueRoutes = require('./routes/league');
const testRoutes = require('./routes/test');

app.use(express.static(path.join(__dirname, 'public')));

const store = new MongoDBStore({
  uri: MONGODB_URL,
  collection: 'sessions',
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'defaultsecretkey',
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/league', leagueRoutes);
app.use('/api/test', testRoutes);

app.get('/', (req, res) => {
  res.send('OK');
});

app.use((req, res, next) => {
  res.status(404).send('<h1>Page not found</h1>');
});
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

const uri = MONGODB_URL;
mongoose
  .connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    app.listen(process.env.PORT || 3000);
  })
  .catch((err) => console.log(err));
