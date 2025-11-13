import mongoose, { Model } from 'mongoose';
import { BaseDocument, ObjectId } from '../types/base.js';

const { Schema } = mongoose;

export interface IStudio {
  leagueId: ObjectId;
  name: string;
}

export interface IStudioDocument extends IStudio, BaseDocument {}

const StudioSchema = new Schema<IStudioDocument>(
  {
    leagueId: {
      type: Schema.Types.ObjectId,
      ref: 'League',
      index: true,
      required: true,
    },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// Prevent duplicate studio names within the same league (case-insensitive)
StudioSchema.index(
  { leagueId: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

const StudioModel: Model<IStudioDocument> =
  (mongoose.models.Studio as Model<IStudioDocument>) ||
  mongoose.model<IStudioDocument>('Studio', StudioSchema);

export default StudioModel;
