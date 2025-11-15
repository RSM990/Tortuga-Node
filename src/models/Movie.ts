import mongoose, { Model } from 'mongoose';
import { BaseDocument } from '../types/base.js';

const { Schema } = mongoose;

export interface IMovie {
  title: string;
  slug?: string;
  releaseDate: Date;
  director?: string;
  distributor?: string;
  genres: string[];
  runtimeMin?: number;
  imageUrl: string;
  posterUrl?: string;
  sources: {
    bom?: {
      url?: string;
      bomId?: string;
    };
    tmdb?: {
      id?: string;
    };
  };
}

// ✅ Now consistent with all other models - extends BaseDocument instead of manually defining fields
export interface IMovieDocument extends IMovie, BaseDocument {}

const MovieSchema = new Schema<IMovieDocument>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, index: true }, // Intentionally non-unique
    releaseDate: {
      type: Date,
      required: [true, "A movie's release date is required"],
      index: true,
    },
    director: { type: String, trim: true },
    distributor: { type: String, trim: true, index: true },
    genres: [{ type: String, trim: true }],
    runtimeMin: { type: Number, min: 0 },
    imageUrl: { type: String, required: true },
    posterUrl: { type: String },
    sources: {
      bom: {
        url: { type: String },
        bomId: { type: String },
      },
      tmdb: {
        id: { type: String },
      },
    },
  },
  {
    timestamps: true, // Use Mongoose's built-in timestamp handling
  }
);

// Compound indexes for common queries
MovieSchema.index({ title: 1, releaseDate: -1 });
MovieSchema.index({ distributor: 1, releaseDate: -1 });
MovieSchema.index({ genres: 1, releaseDate: -1 });
MovieSchema.index({ releaseDate: -1 });

const MovieModel: Model<IMovieDocument> =
  (mongoose.models.Movie as Model<IMovieDocument>) ||
  mongoose.model<IMovieDocument>('Movie', MovieSchema);

export default MovieModel;
