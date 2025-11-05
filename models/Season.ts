// src/models/Season.ts
import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

const SeasonSchema = new Schema(
  {
    leagueId: {
      type: Types.ObjectId,
      ref: 'League',
      index: true,
      required: true,
    },
    label: { type: String, required: true },
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

// Overwrite-safe export
export default (mongoose.models.Season as mongoose.Model<any>) ||
  mongoose.model('Season', SeasonSchema);

// Optional TS type
export type SeasonDoc = mongoose.InferSchemaType<typeof SeasonSchema> & {
  _id: mongoose.Types.ObjectId;
};
