// src/models/StudioWeeklyRevenue.ts
import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

const StudioWeeklyRevenueSchema = new Schema(
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
    weekIndex: { type: Number, index: true, required: true, min: 0 },
    weekStart: { type: Date, required: true },
    weekEnd: {
      type: Date,
      required: true,
      validate: {
        validator(this: any, v: Date) {
          return this.weekStart && v > this.weekStart;
        },
        message: 'weekEnd must be after weekStart',
      },
    },
    totalDomesticGross: { type: Number, default: 0 },
    totalWorldwideGross: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Uniqueness: one row per (season, week, studio)
StudioWeeklyRevenueSchema.index(
  { seasonId: 1, weekIndex: 1, studioId: 1 },
  { unique: true }
);

// Helpful lookups
StudioWeeklyRevenueSchema.index({ seasonId: 1, weekIndex: 1 });
StudioWeeklyRevenueSchema.index({ leagueId: 1, seasonId: 1 });

export default (mongoose.models.StudioWeeklyRevenue as mongoose.Model<any>) ||
  mongoose.model('StudioWeeklyRevenue', StudioWeeklyRevenueSchema);

// Optional TS type
export type StudioWeeklyRevenueDoc = mongoose.InferSchemaType<
  typeof StudioWeeklyRevenueSchema
> & { _id: mongoose.Types.ObjectId };
