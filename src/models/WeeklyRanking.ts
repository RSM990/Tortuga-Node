import mongoose, { Model } from 'mongoose';
import { BaseDocument, ObjectId } from '../types/base.js';

const { Schema } = mongoose;

interface IRankingRow {
  studioId: ObjectId;
  rank: number;
  points: number;
  revenue: number;
}

export interface IWeeklyRanking {
  leagueId: ObjectId;
  seasonId: ObjectId;
  weekIndex: number;
  rows: IRankingRow[];
}

export interface IWeeklyRankingDocument extends IWeeklyRanking, BaseDocument {}

const WeeklyRankingSchema = new Schema<IWeeklyRankingDocument>(
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
    weekIndex: { type: Number, index: true, required: true, min: 0 },
    rows: [
      {
        studioId: {
          type: Schema.Types.ObjectId,
          ref: 'Studio',
          required: true,
        },
        rank: { type: Number, min: 1, required: true },
        points: { type: Number, min: 0, default: 0 },
        revenue: { type: Number, min: 0, default: 0 },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

// One ranking table per (season, week)
WeeklyRankingSchema.index({ seasonId: 1, weekIndex: 1 }, { unique: true });

// Helpful lookups
WeeklyRankingSchema.index({ leagueId: 1, seasonId: 1, weekIndex: 1 });

const WeeklyRankingModel: Model<IWeeklyRankingDocument> =
  (mongoose.models.WeeklyRanking as Model<IWeeklyRankingDocument>) ||
  mongoose.model<IWeeklyRankingDocument>('WeeklyRanking', WeeklyRankingSchema);

export default WeeklyRankingModel;
