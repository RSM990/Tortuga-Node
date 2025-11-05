// src/models/MovieWeeklyRevenue.ts
import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

const MovieWeeklyRevenueSchema = new Schema(
  {
    movieId: {
      type: Types.ObjectId,
      ref: 'Movie',
      index: true,
      required: true,
    },
    weekStart: { type: Date, index: true, required: true },
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
    domesticGross: { type: Number, default: 0 },
    worldwideGross: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One entry per movie per week
MovieWeeklyRevenueSchema.index({ movieId: 1, weekStart: 1 }, { unique: true });

// Helpful lookups
MovieWeeklyRevenueSchema.index({ weekStart: 1 });
MovieWeeklyRevenueSchema.index({ weekEnd: 1 });

// Overwrite-safe export
export default (mongoose.models.MovieWeeklyRevenue as mongoose.Model<any>) ||
  mongoose.model('MovieWeeklyRevenue', MovieWeeklyRevenueSchema);

// Optional TS type
export type MovieWeeklyRevenueDoc = mongoose.InferSchemaType<
  typeof MovieWeeklyRevenueSchema
> & {
  _id: mongoose.Types.ObjectId;
};
