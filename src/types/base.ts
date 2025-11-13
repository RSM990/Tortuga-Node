import mongoose, { Document } from 'mongoose';

/**
 * Base document interface with common fields all models share
 * All model document interfaces should extend this
 */
export interface BaseDocument extends Document {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Utility type to infer document type from schema
 * Combines schema fields with base document fields
 */
export type SchemaDocument<T> = T & BaseDocument;

/**
 * Helper type for model references
 */
export type ObjectId = mongoose.Types.ObjectId;

/**
 * Helper type for optional references
 */
export type OptionalRef<T> = mongoose.Types.ObjectId | T;
