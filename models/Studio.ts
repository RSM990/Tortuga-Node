// src/models/Studio.ts
import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

const StudioSchema = new Schema(
  {
    leagueId: {
      type: Types.ObjectId,
      ref: 'League',
      index: true,
      required: true,
    },
    name: { type: String, required: true },
  },
  { timestamps: true }
);

// Prevent duplicate studio names within the same league (case-insensitive)
StudioSchema.index(
  { leagueId: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

// Overwrite-safe export
export default (mongoose.models.Studio as mongoose.Model<any>) ||
  mongoose.model('Studio', StudioSchema);

// Optional TS type
export type StudioDoc = mongoose.InferSchemaType<typeof StudioSchema> & {
  _id: mongoose.Types.ObjectId;
};
