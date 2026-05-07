const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
    },
    reviewerId: {
      type: String,
      required: true,
    },
    receiverId: {
      type: String,
      required: true,
    },
    rating: {
      type: String,
      required: true,
    },
    comment: {
      type: String,
      required: true,
    },
    reviewerType: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Modified: Unique index removed because encrypted IDs are non-deterministic
// reviewSchema.index({ projectId: 1, reviewerId: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);