const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  budget: { type: Number, required: true },
  deadline: { type: Date, required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "selected", "accepted", "done"], default: "pending" }, 
  acceptedFreelancer: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Added field to store accepted freelancer
  acceptedmoney: { type: Number }, // Added field to store accepted money
  completedpercentage: { type: Number, default: 0 }, // Added field to store completed percentage
  amount: { type: Number }, // Remove `required: true`
  escrowStatus: { 
    type: String, 
    enum: ["Not Funded", "Funded", "Released", "Refunded"], // Ensure correct casing
    default: "Not Funded" 
  },
  paymentIntentId: { type: String },
  completionUrl: { type: String, default: "" }, // URL of the completed project
  approvalStatus: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" }, // Approval status
  rejectionComment: { type: String, default: null },
  claimStatus: { type: String, enum: ["Pending", "Claimed"], default: "Pending" }, // Claim status
  
}, { timestamps: true });

projectSchema.index({ client: 1, title: 1 }, { unique: true });

module.exports = mongoose.model("Project", projectSchema);