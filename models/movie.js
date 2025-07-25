const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const movieSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  releaseDate: {
    type: Date,
    required: [true, "a movie's release date is required"],
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
  createdAt: {
    type: Date,
    default: Date.now,
    select: false,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    select: false,
  },
});

module.exports = mongoose.model('Movie', movieSchema);
