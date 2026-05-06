const mongoose = require("mongoose");

const freelancerInformationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", 
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
  earnings: {
    type: Number, 
    default: 0,
  },
  reviews: {
    type: Number, 
    default: 0,
  },
  projectsCompleted: {
    type: Number, 
    default: 0,
  },
});

module.exports = mongoose.model("FreelancerInformation", freelancerInformationSchema);