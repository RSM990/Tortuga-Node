const express = require('express');
const cors = require('cors');

const path = require('path');

const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const cookieParser = require('cookie-parser');

const MONGODB_URL =
  'mongodb+srv://tortugaDBadmin:password12345@tortuga.2ftyd.mongodb.net/?appName=Tortuga';

const app = express();

const store = new MongoDBStore({
  uri: MONGODB_URL,
  collection: 'sessions',
});

app.set('trust proxy', true);

app.use((req, res, next) => {
  // Check if the environment is production
  if (process.env.NODE_ENV === 'production') {
    // Only redirect if the connection is not secure (HTTP)
    if (!req.secure) {
      return res.redirect('https://' + req.headers.host + req.url); // Redirect to HTTPS
    }
  }
  next();
});

app.use(cookieParser());

const authRoutes = require('./routes/auth');
const movieRoutes = require('./routes/movies');
const leagueRoutes = require('./routes/league');
const testRoutes = require('./routes/test');

app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: 'my secret value',
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

const isProd = process.env.NODE_ENV === 'production';

const allowedOrigins = [
  'https://tortugatest.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use('/auth', authRoutes);
app.use('/movies', movieRoutes);
app.use('/league', leagueRoutes);
app.use('/test', testRoutes);

app.get('/', (req, res) => {
  res.send('OK');
});
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.use((req, res, next) => {
  res.status(404).send('<h1>Page not found</h1>');
});

const uri = MONGODB_URL;
mongoose
  .connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    app.listen(3000);
  })
  .catch((err) => console.log(err));
