// src/models/User.ts
import mongoose from 'mongoose';

const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    firstName: String,
    lastName: String,
    leagues: [{ type: Schema.Types.ObjectId, ref: 'League' }],
  },
  { timestamps: true }
);

// Guard against recompilation
export default (mongoose.models.User as mongoose.Model<any>) ||
  mongoose.model('User', UserSchema);
