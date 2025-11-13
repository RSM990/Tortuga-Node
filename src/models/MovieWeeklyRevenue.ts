import mongoose, { Model } from 'mongoose';
import { BaseDocument, ObjectId } from '../types/base.js';

const { Schema } = mongoose;

export interface IMovieWeeklyRevenue {
  movieId: ObjectId;
  weekStart: Date;
  weekEnd: Date;
  domesticGross: number;
  worldwideGross: number;
}

export interface IMovieWeeklyRevenueDocument
  extends IMovieWeeklyRevenue,
    BaseDocument {}

const MovieWeeklyRevenueSchema = new Schema<IMovieWeeklyRevenueDocument>(
  {
    movieId: {
      type: Schema.Types.ObjectId,
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

const MovieWeeklyRevenueModel: Model<IMovieWeeklyRevenueDocument> =
  (mongoose.models.MovieWeeklyRevenue as Model<IMovieWeeklyRevenueDocument>) ||
  mongoose.model<IMovieWeeklyRevenueDocument>(
    'MovieWeeklyRevenue',
    MovieWeeklyRevenueSchema
  );

export default MovieWeeklyRevenueModel;
