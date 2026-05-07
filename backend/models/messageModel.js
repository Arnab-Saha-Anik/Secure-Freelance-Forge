const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    receiverId: { type: String, required: true },
    content: { type: String, required: true },
    read: { type: String }, // Modified: String for ECC encryption
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
