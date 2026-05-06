const mongoose = require("mongoose");

const directHireSchema = new mongoose.Schema({
  freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  // status: { type: String, enum: ["pending", "accepted", "done"], default: "pending" }, // New field
  createdAt: { type: Date, default: Date.now },
});

// Ensure the composite key is unique
directHireSchema.index({ freelancerId: 1, clientId: 1, projectId: 1 }, { unique: true });

module.exports = mongoose.model("DirectHire", directHireSchema);