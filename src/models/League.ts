import mongoose, { Model } from 'mongoose';
import { BaseDocument, ObjectId } from '../types/base.js';

const { Schema } = mongoose;

interface ILeagueAwardConfig {
  key: string;
  enabled: boolean;
  nominationPoints: number;
  winPoints: number;
}

interface IRefundPolicy {
  enabled: boolean;
  type?: 'zeroRevenueWeeks' | 'profitAware';
  threshold?: number;
  refundPercent?: number;
  profitPolicy?: {
    refundMode: 'profitAmount' | 'profitPercent';
    profitBasis: 'domestic' | 'worldwide';
    floorAtZero: boolean;
    capMultiple?: number;
    lossRefundPercent: number;
  };
}

export interface ILeague {
  name: string;
  slug: string;
  visibility: 'private' | 'unlisted' | 'public';
  ownerId: ObjectId;
  commissionerIds: ObjectId[];
  timezone: string;
  budgetCap: number;
  pointsScheme: 'optionB' | 'custom';
  customPointTable?: Map<string, number>;
  awardCategories: ILeagueAwardConfig[];
  refundRule: IRefundPolicy;
}

export interface ILeagueDocument extends ILeague, BaseDocument {}

const LeagueAwardConfig = new Schema(
  {
    key: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    nominationPoints: { type: Number, default: 1 },
    winPoints: { type: Number, default: 2 },
  },
  { _id: false }
);

const RefundPolicy = new Schema(
  {
    enabled: { type: Boolean, default: false },
    type: { type: String, enum: ['zeroRevenueWeeks', 'profitAware'] },
    threshold: Number,
    refundPercent: Number,
    profitPolicy: {
      refundMode: {
        type: String,
        enum: ['profitAmount', 'profitPercent'],
        default: 'profitPercent',
      },
      profitBasis: {
        type: String,
        enum: ['domestic', 'worldwide'],
        default: 'worldwide',
      },
      floorAtZero: { type: Boolean, default: true },
      capMultiple: Number,
      lossRefundPercent: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const LeagueSchema = new Schema<ILeagueDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    visibility: {
      type: String,
      enum: ['private', 'unlisted', 'public'],
      default: 'private',
    },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    commissionerIds: [
      { type: Schema.Types.ObjectId, ref: 'User', index: true },
    ],
    timezone: { type: String, default: 'America/New_York' },
    budgetCap: { type: Number, default: 100 },
    pointsScheme: {
      type: String,
      enum: ['optionB', 'custom'],
      default: 'optionB',
    },
    customPointTable: { type: Map, of: Number },
    awardCategories: { type: [LeagueAwardConfig], default: [] },
    refundRule: { type: RefundPolicy, default: () => ({ enabled: false }) },
  },
  { timestamps: true }
);

const LeagueModel: Model<ILeagueDocument> =
  (mongoose.models.League as Model<ILeagueDocument>) ||
  mongoose.model<ILeagueDocument>('League', LeagueSchema);

export default LeagueModel;
