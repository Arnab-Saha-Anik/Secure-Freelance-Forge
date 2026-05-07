const mongoose = require("mongoose");

const freelancerInformationSchema = new mongoose.Schema({
  userId: {
    type: String, 
    required: true,
  },
  skills: {
    type: [String], 
    required: true,
    default: [],
  },
  portfolio: {
    type: String, 
    required: true,
  },
  experience: {
    type: String, 
    required: true,
  },
  // Modified: No default — always set explicitly via rsaEncrypt("0") in the controller
  earnings: {
    type: String,
  },
  // Modified: No default — always set explicitly via rsaEncrypt("0") in the controller
  reviews: {
    type: String,
  },
  // Modified: No default — always set explicitly via rsaEncrypt("0") in the controller
  projectsCompleted: {
    type: String,
  },
});

module.exports = mongoose.model("FreelancerInformation", freelancerInformationSchema);