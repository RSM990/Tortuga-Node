import mongoose, { Model } from 'mongoose';
import { BaseDocument, ObjectId } from '../types/base.js';

const { Schema } = mongoose;

export interface IAwardBonus {
  leagueId: ObjectId;
  seasonId: ObjectId;
  studioId: ObjectId;
  movieId?: ObjectId;
  categoryKey: string;
  result: 'nom' | 'win';
  points: number;
  awardedAt: Date;
}

export interface IAwardBonusDocument extends IAwardBonus, BaseDocument {}

const AwardBonusSchema = new Schema<IAwardBonusDocument>(
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
      required: true,
      index: true,
    },
    movieId: { type: Schema.Types.ObjectId, ref: 'Movie', index: true },
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

const AwardBonusModel: Model<IAwardBonusDocument> =
  (mongoose.models.AwardBonus as Model<IAwardBonusDocument>) ||
  mongoose.model<IAwardBonusDocument>('AwardBonus', AwardBonusSchema);

export default AwardBonusModel;
