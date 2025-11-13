import mongoose, { Model } from 'mongoose';
import { BaseDocument, ObjectId } from '../types/base.js';

const { Schema } = mongoose;

export interface ISeason {
  leagueId: ObjectId;
  label: string;
  startDate: Date;
  endDate: Date;
  weekCount: number;
}

export interface ISeasonDocument extends ISeason, BaseDocument {}

const SeasonSchema = new Schema<ISeasonDocument>(
  {
    leagueId: {
      type: Schema.Types.ObjectId,
      ref: 'League',
      index: true,
      required: true,
    },
    label: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator(this: any, v: Date) {
          return this.startDate && v > this.startDate;
        },
        message: 'endDate must be after startDate',
      },
    },
    weekCount: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

// Prevent duplicate labels within the same league (case-insensitive)
SeasonSchema.index(
  { leagueId: 1, label: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

const SeasonModel: Model<ISeasonDocument> =
  (mongoose.models.Season as Model<ISeasonDocument>) ||
  mongoose.model<ISeasonDocument>('Season', SeasonSchema);

export default SeasonModel;
