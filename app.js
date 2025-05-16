const path = require('path');

const express = require('express');

const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);

const cors = require('cors');

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

const authRoutes = require('./routes/auth');
const movieRoutes = require('./routes/movies');
const leagueRoutes = require('./routes/league');

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

app.use((req, res, next) => {
  //   User.findByPk(1)
  //     .then((user) => {
  //       req.user = user;
  //       next();
  //     })
  //     .catch((err) => console.log(err));
  next();
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'OPTIONS, GET, POST, PUT, PATCH, DELETE'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});
app.use(
  // cors({
  //   origin: 'http://localhost:5173', // Allow requests from frontend
  //   credentials: true, // Required for cookies, sessions, etc.
  //   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // })
  // cors()
  cors()
);

app.use('/auth', authRoutes);
app.use('/movies', movieRoutes);
app.use('/league', leagueRoutes);

// app.use('/order', orderRoutes);
// app.use('/cart', cartRoutes);

app.get('/', (req, res) => {
  res.send('OK');
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
