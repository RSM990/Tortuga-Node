const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const movieSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  slug: { type: String, index: true, unique: false }, // we'll keep non-unique for now to avoid index conflicts
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
  genres: [{ type: String }],
  runtimeMin: { type: Number },
  imageUrl: {
    type: String,
    required: true,
  },
  posterUrl: { type: String }, // separate from imageUrl, if you already use that in FE we keep both
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
  sources: {
    bom: {
      url: { type: String },
      bomId: { type: String },
    },
    tmdb: {
      id: { type: String },
    },
  },
});

movieSchema.index({ title: 1, releaseDate: -1 });
movieSchema.index({ distributor: 1, releaseDate: -1 });
movieSchema.index({ genres: 1, releaseDate: -1 });
movieSchema.index({ releaseDate: -1 });

module.exports = mongoose.model('Movie', movieSchema);
