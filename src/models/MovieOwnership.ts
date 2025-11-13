import mongoose, { Model } from 'mongoose';
import { BaseDocument, ObjectId } from '../types/base.js';

const { Schema } = mongoose;

export interface IMovieOwnership {
  leagueId: ObjectId;
  seasonId: ObjectId;
  studioId: ObjectId;
  movieId: ObjectId;
  purchasePrice: number;
  acquiredAt: Date;
  retiredAt?: Date;
  refundApplied: boolean;
}

export interface IMovieOwnershipDocument
  extends IMovieOwnership,
    BaseDocument {}

const MovieOwnershipSchema = new Schema<IMovieOwnershipDocument>(
  {
    leagueId: {
      type: Schema.Types.ObjectId,
      ref: 'League',
      index: true,
      required: true,
    },
    seasonId: {
      type: Schema.Types.ObjectId,
      ref: 'Season',
      index: true,
      required: true,
    },
    studioId: {
      type: Schema.Types.ObjectId,
      ref: 'Studio',
      index: true,
      required: true,
    },
    movieId: {
      type: Schema.Types.ObjectId,
      ref: 'Movie',
      index: true,
      required: true,
    },
    purchasePrice: { type: Number, required: true },
    acquiredAt: { type: Date, required: true },
    retiredAt: { type: Date },
    refundApplied: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One (season, movie) can only be owned once
MovieOwnershipSchema.index({ seasonId: 1, movieId: 1 }, { unique: true });

// Helpful lookups
MovieOwnershipSchema.index({ leagueId: 1, seasonId: 1, studioId: 1 });
MovieOwnershipSchema.index({ studioId: 1, movieId: 1 });

const MovieOwnershipModel: Model<IMovieOwnershipDocument> =
  (mongoose.models.MovieOwnership as Model<IMovieOwnershipDocument>) ||
  mongoose.model<IMovieOwnershipDocument>(
    'MovieOwnership',
    MovieOwnershipSchema
  );

export default MovieOwnershipModel;
