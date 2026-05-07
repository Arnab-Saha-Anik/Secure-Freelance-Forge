const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  budget: { type: String, required: true },
  deadline: { type: String, required: true },
  client: { type: String, required: true },
  status: { type: String, default: "pending" }, 
  acceptedFreelancer: { type: String }, 
  acceptedmoney: { type: String }, 
  completedpercentage: { type: String, default: "0" }, 
  amount: { type: String }, 
  escrowStatus: { type: String, default: "Not Funded" },
  paymentIntentId: { type: String },
  completionUrl: { type: String, default: "" }, 
  approvalStatus: { type: String, default: "Pending" }, 
  rejectionComment: { type: String, default: null },
  claimStatus: { type: String, default: "Pending" }, 
}, { timestamps: true });

projectSchema.index({ client: 1, title: 1 }, { unique: false });

module.exports = mongoose.model("Project", projectSchema);