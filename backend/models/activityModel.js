const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true }, // Description of the activity
    timestamp: { type: Date, default: Date.now }, // When the activity occurred
  },
  { timestamps: true }
);

module.exports = mongoose.model("Activity", activitySchema);