import mongoose, { Model } from 'mongoose';
import { BaseDocument, ObjectId } from '../types/base.js';

const { Schema } = mongoose;

export interface IStudioOwner {
  leagueId: ObjectId;
  studioId: ObjectId;
  userId: ObjectId;
  roleInStudio: 'owner' | 'manager';
}

export interface IStudioOwnerDocument extends IStudioOwner, BaseDocument {}

const StudioOwnerSchema = new Schema<IStudioOwnerDocument>(
  {
    leagueId: {
      type: Schema.Types.ObjectId,
      ref: 'League',
      required: true,
      index: true,
    },
    studioId: {
      type: Schema.Types.ObjectId,
      ref: 'Studio',
      index: true,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
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

// CRITICAL BUSINESS RULE: A user can only belong to ONE studio per league
StudioOwnerSchema.index({ leagueId: 1, userId: 1 }, { unique: true });

// Also prevent duplicate links to the same studio
StudioOwnerSchema.index({ studioId: 1, userId: 1 }, { unique: true });

const StudioOwnerModel: Model<IStudioOwnerDocument> =
  (mongoose.models.StudioOwner as Model<IStudioOwnerDocument>) ||
  mongoose.model<IStudioOwnerDocument>('StudioOwner', StudioOwnerSchema);

export default StudioOwnerModel;
