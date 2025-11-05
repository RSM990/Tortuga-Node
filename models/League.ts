// src/models/League.ts
import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

const LeagueAwardConfig = new Schema(
  {
    key: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    nominationPoints: { type: Number, default: 1 },
    winPoints: { type: Number, default: 2 },
  },
  { _id: false } // no separate _id for each category config (optional)
);

const RefundPolicy = new Schema(
  {
    enabled: { type: Boolean, default: false },
    type: { type: String, enum: ['zeroRevenueWeeks', 'profitAware'] },
    threshold: Number, // for zeroRevenueWeeks
    refundPercent: Number, // for zeroRevenueWeeks
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

const LeagueSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    visibility: {
      type: String,
      enum: ['private', 'unlisted', 'public'],
      default: 'private',
    },
    ownerId: { type: Types.ObjectId, ref: 'User', required: true },
    commissionerIds: [{ type: Types.ObjectId, ref: 'User', index: true }],
    timezone: { type: String, default: 'America/New_York' },
    budgetCap: { type: Number, default: 100 },
    pointsScheme: {
      type: String,
      enum: ['optionB', 'custom'],
      default: 'optionB',
    },
    // rank -> points (only when pointsScheme === 'custom')
    customPointTable: { type: Map, of: Number },
    awardCategories: { type: [LeagueAwardConfig], default: [] },
    refundRule: { type: RefundPolicy, default: () => ({ enabled: false }) },
  },
  { timestamps: true }
);

// Overwrite-safe export (prevents "Cannot overwrite model once compiled")
export default (mongoose.models.League as mongoose.Model<any>) ||
  mongoose.model('League', LeagueSchema);

// Optional TS types you can import elsewhere
export type LeagueDoc = mongoose.InferSchemaType<typeof LeagueSchema> & {
  _id: mongoose.Types.ObjectId;
};
