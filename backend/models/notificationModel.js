const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);