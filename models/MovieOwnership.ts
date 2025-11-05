// src/models/MovieOwnership.ts
import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

const MovieOwnershipSchema = new Schema(
  {
    leagueId: {
      type: Types.ObjectId,
      ref: 'League',
      index: true,
      required: true,
    },
    seasonId: {
      type: Types.ObjectId,
      ref: 'Season',
      index: true,
      required: true,
    },
    studioId: {
      type: Types.ObjectId,
      ref: 'Studio',
      index: true,
      required: true,
    },
    movieId: {
      type: Types.ObjectId,
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

// Overwrite-safe export
export default (mongoose.models.MovieOwnership as mongoose.Model<any>) ||
  mongoose.model('MovieOwnership', MovieOwnershipSchema);

// Optional TS type
export type MovieOwnershipDoc = mongoose.InferSchemaType<
  typeof MovieOwnershipSchema
> & {
  _id: mongoose.Types.ObjectId;
};
