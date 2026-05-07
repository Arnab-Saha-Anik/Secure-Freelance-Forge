const mongoose = require("mongoose");

const directHireSchema = new mongoose.Schema({
  freelancerId: { type: String, required: true },
  clientId: { type: String, required: true },
  projectId: { type: String, required: true },
  // status: { type: String, enum: ["pending", "accepted", "done"], default: "pending" }, // New field
  createdAt: { type: Date, default: Date.now },
});

// Modified: Composite unique index removed because encrypted IDs are non-deterministic
// directHireSchema.index({ freelancerId: 1, clientId: 1, projectId: 1 }, { unique: true });

module.exports = mongoose.model("DirectHire", directHireSchema);