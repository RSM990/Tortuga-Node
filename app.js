const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.set('trust proxy', true);
// const userRoutes = require('./routes/user');
const movieRoutes = require('./routes/movies');

app.use(bodyParser.json());

app.use(
  // cors({
  //   origin: 'http://localhost:5173', // Allow requests from frontend
  //   credentials: true, // Required for cookies, sessions, etc.
  // })
  cors()
);
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  //   User.findByPk(1)
  //     .then((user) => {
  //       req.user = user;
  //       next();
  //     })
  //     .catch((err) => console.log(err));
  next();
});

app.use('/movies', movieRoutes);
// app.use('/user', userRoutes);
// app.use('/order', orderRoutes);
// app.use('/cart', cartRoutes);

app.get('/', (req, res) => {
  res.send('OK');
});

app.use((req, res, next) => {
  res.status(404).send('<h1>Page not found</h1>');
});

const uri =
  'mongodb+srv://tortugaDBadmin:password12345@tortuga.2ftyd.mongodb.net/?appName=Tortuga';

mongoose
  .connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    app.listen(3000);
  })
  .catch((err) => console.log(err));
