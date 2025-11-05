// src/models/AwardBonus.ts
import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

const AwardBonusSchema = new Schema(
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
      required: true,
      index: true,
    },
    movieId: { type: Types.ObjectId, ref: 'Movie', index: true },
    categoryKey: { type: String, required: true },
    result: { type: String, enum: ['nom', 'win'], required: true },
    points: { type: Number, required: true },
    awardedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// Prevent duplicate bonuses for the same tuple
AwardBonusSchema.index(
  { seasonId: 1, studioId: 1, movieId: 1, categoryKey: 1, result: 1 },
  { unique: true }
);

// Overwrite-safe export
export default (mongoose.models.AwardBonus as mongoose.Model<any>) ||
  mongoose.model('AwardBonus', AwardBonusSchema);

// Optional TS type
export type AwardBonusDoc = mongoose.InferSchemaType<
  typeof AwardBonusSchema
> & {
  _id: mongoose.Types.ObjectId;
};
