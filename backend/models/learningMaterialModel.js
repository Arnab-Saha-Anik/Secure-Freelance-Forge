const mongoose = require("mongoose");

const learningMaterialSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  link: { type: String, required: true },
  postedBy: { type: String, required: true },
});

module.exports = mongoose.model("LearningMaterial", learningMaterialSchema);