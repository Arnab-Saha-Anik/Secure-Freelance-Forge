const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema({
  projectId: {
    type: String,
    required: true,
  },
  freelancerId: {
    type: String,
    required: true,
  },
  amount: {
    type: String,
    required: true,
  },
  status: {
    type: String,
  },
});

module.exports = mongoose.model("Bid", bidSchema);