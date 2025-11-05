// src/models/WeeklyRanking.ts
import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

const WeeklyRankingSchema = new Schema(
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
    weekIndex: { type: Number, index: true, required: true, min: 0 },
    rows: [
      {
        studioId: { type: Types.ObjectId, ref: 'Studio', required: true },
        rank: { type: Number, min: 1 }, // 1-based ranking
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

// Overwrite-safe export
export default (mongoose.models.WeeklyRanking as mongoose.Model<any>) ||
  mongoose.model('WeeklyRanking', WeeklyRankingSchema);

// Optional TS type
export type WeeklyRankingDoc = mongoose.InferSchemaType<
  typeof WeeklyRankingSchema
> & {
  _id: mongoose.Types.ObjectId;
};
