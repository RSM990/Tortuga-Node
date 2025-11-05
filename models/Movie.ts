// src/models/Movie.ts
import mongoose from 'mongoose';

const { Schema } = mongoose;

const MovieSchema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, index: true, unique: false }, // non-unique per your note
    releaseDate: {
      type: Date,
      required: [true, "a movie's release date is required"],
    },
    director: { type: String },
    distributor: { type: String },
    genres: [{ type: String }],
    runtimeMin: { type: Number },
    imageUrl: { type: String, required: true },
    posterUrl: { type: String },

    // keep explicit createdAt/updatedAt with select:false (you already rely on them)
    createdAt: { type: Date, default: Date.now, select: false },
    updatedAt: { type: Date, default: Date.now, select: false },

    sources: {
      bom: {
        url: { type: String },
        bomId: { type: String },
      },
      tmdb: {
        id: { type: String },
      },
    },
  },
  {
    // if you want automatic timestamps instead, use: timestamps: true
    // but that would expose them unless you also hide in queries/DTOs
  }
);

// indexes
MovieSchema.index({ title: 1, releaseDate: -1 });
MovieSchema.index({ distributor: 1, releaseDate: -1 });
MovieSchema.index({ genres: 1, releaseDate: -1 });
MovieSchema.index({ releaseDate: -1 });

// keep updatedAt in sync when saving
MovieSchema.pre('save', function (next) {
  (this as any).updatedAt = new Date();
  next();
});

// Overwrite-safe export
export default (mongoose.models.Movie as mongoose.Model<any>) ||
  mongoose.model('Movie', MovieSchema);

// Optional TS type
export type MovieDoc = mongoose.InferSchemaType<typeof MovieSchema> & {
  _id: mongoose.Types.ObjectId;
};
