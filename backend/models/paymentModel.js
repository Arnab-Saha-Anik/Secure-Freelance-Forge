const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    project: { type: String, required: true },
    client: { type: String, required: true },
    freelancer: { type: String },
    amount: { type: String, required: true },
    status: { type: String }, // Modified: String for ECC encryption
    paymentIntentId: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);