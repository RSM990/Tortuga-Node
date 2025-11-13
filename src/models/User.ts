import mongoose, { Model } from 'mongoose';
import { BaseDocument } from '../types/base.js';

const { Schema } = mongoose;

export interface IUser {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

// Now just extend BaseDocument - no need to repeat _id, createdAt, updatedAt!
export interface IUserDocument extends IUser, BaseDocument {}

const UserSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
  },
  { timestamps: true } // This adds createdAt/updatedAt automatically
);

const UserModel: Model<IUserDocument> =
  (mongoose.models.User as Model<IUserDocument>) ||
  mongoose.model<IUserDocument>('User', UserSchema);

export default UserModel;
