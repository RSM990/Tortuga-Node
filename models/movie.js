const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const movieSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  releaseDate: {
    type: Date,
    required: true,
  },
  director: {
    type: String,
  },
  distributor: {
    type: String,
  },
  imageUrl: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model('Movie', movieSchema);
