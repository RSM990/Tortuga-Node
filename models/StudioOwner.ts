// src/models/StudioOwner.ts
import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

const StudioOwnerSchema = new Schema(
  {
    leagueId: {
      type: Types.ObjectId,
      ref: 'League',
      required: true,
      index: true,
    },
    studioId: {
      type: Types.ObjectId,
      ref: 'Studio',
      index: true,
      required: true,
    },
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    roleInStudio: {
      type: String,
      enum: ['owner', 'manager'],
      default: 'owner',
    },
  },
  { timestamps: true }
);

// A user can only belong to ONE studio per league:
StudioOwnerSchema.index({ leagueId: 1, userId: 1 }, { unique: true });
// Also prevent duplicate links to the same studio:
StudioOwnerSchema.index({ studioId: 1, userId: 1 }, { unique: true });

// Overwrite-safe export
export default (mongoose.models.StudioOwner as mongoose.Model<any>) ||
  mongoose.model('StudioOwner', StudioOwnerSchema);

// Optional TS type
export type StudioOwnerDoc = mongoose.InferSchemaType<
  typeof StudioOwnerSchema
> & {
  _id: mongoose.Types.ObjectId;
};
