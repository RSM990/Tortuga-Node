import mongoose, { Model } from 'mongoose';
import { BaseDocument, ObjectId } from '../types/base.js';

const { Schema } = mongoose;

export interface IStudioWeeklyRevenue {
  leagueId: ObjectId;
  seasonId: ObjectId;
  studioId: ObjectId;
  weekIndex: number;
  weekStart: Date;
  weekEnd: Date;
  totalDomesticGross: number;
  totalWorldwideGross: number;
}

export interface IStudioWeeklyRevenueDocument
  extends IStudioWeeklyRevenue,
    BaseDocument {}

const StudioWeeklyRevenueSchema = new Schema<IStudioWeeklyRevenueDocument>(
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

const StudioWeeklyRevenueModel: Model<IStudioWeeklyRevenueDocument> =
  (mongoose.models
    .StudioWeeklyRevenue as Model<IStudioWeeklyRevenueDocument>) ||
  mongoose.model<IStudioWeeklyRevenueDocument>(
    'StudioWeeklyRevenue',
    StudioWeeklyRevenueSchema
  );

export default StudioWeeklyRevenueModel;
