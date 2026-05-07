const express = require("express");
const router = express.Router();
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const { verifyToken } = require("../middleware/authMiddleware");
const { eccEncrypt, eccDecrypt, decrypt } = require("../utils/cryptoUtils");

// Helper: build a stable conversationId from two user IDs
const buildConversationId = (id1, id2) =>
  [id1, id2].sort().join("_");

// --- POST /messages/send ---
// Send a message from the logged-in user to another user
router.post("/send", verifyToken, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    const senderId = req.user.id;
    let decryptedReceiverId = decrypt(receiverId);
    if (decryptedReceiverId && typeof decryptedReceiverId === 'string' && decryptedReceiverId.startsWith('ecc_')) {
      decryptedReceiverId = decrypt(decryptedReceiverId);
    }

    if (!decryptedReceiverId || !content || !content.trim()) {
      return res.status(400).json({ error: "receiverId and content are required." });
    }

    // Verify receiver exists
    const receiver = await User.findById(decryptedReceiverId);
    if (!receiver) {
      return res.status(404).json({ error: "Receiver not found." });
    }

    const conversationId = buildConversationId(senderId, decryptedReceiverId);

    const message = await Message.create({
      conversationId: eccEncrypt(conversationId),
      senderId: eccEncrypt(senderId),
      receiverId: eccEncrypt(decryptedReceiverId),
      content: eccEncrypt(content.trim()),
      read: eccEncrypt("false"),
    });

    res.status(201).json({
      _id: message._id,
      conversationId,
      senderId,
      receiverId,
      content: content.trim(),
      read: message.read,
      createdAt: message.createdAt,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message." });
  }
});

// --- GET /messages/conversation/:otherId ---
// Get all messages in a conversation between the logged-in user and another user
router.get("/conversation/:otherId", verifyToken, async (req, res) => {
  try {
    const { otherId } = req.params;
    const myId = req.user.id;
    const conversationId = buildConversationId(myId, otherId);

    const allMessages = await Message.find();

    // Filter messages belonging to this conversation
    const conversation = allMessages
      .filter((msg) => {
        const decConvId = decrypt(msg.conversationId);
        return decConvId === conversationId;
      })
      .map((msg) => ({
        _id: msg._id,
        conversationId,
        senderId: decrypt(msg.senderId),
        receiverId: decrypt(msg.receiverId),
        content: decrypt(msg.content),
        read: decrypt(msg.read) === "true",
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Mark all received messages as read
    const unreadIds = conversation
      .filter((m) => m.receiverId === myId && !m.read)
      .map((m) => m._id);

    if (unreadIds.length > 0) {
      await Message.updateMany({ _id: { $in: unreadIds } }, { read: eccEncrypt("true") });
    }

    res.status(200).json(conversation);
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ error: "Failed to fetch conversation." });
  }
});

// --- GET /messages/inbox ---
// Get a list of unique conversations (last message + unread count) for the logged-in user
router.get("/inbox", verifyToken, async (req, res) => {
  try {
    const myId = req.user.id;
    const allMessages = await Message.find();

    // Decrypt and filter messages where this user is involved
    const myMessages = allMessages
      .map((msg) => ({
        _id: msg._id,
        conversationId: decrypt(msg.conversationId),
        senderId: decrypt(msg.senderId),
        receiverId: decrypt(msg.receiverId),
        content: decrypt(msg.content),
        read: decrypt(msg.read) === "true",
        createdAt: msg.createdAt,
      }))
      .filter((msg) => msg.senderId === myId || msg.receiverId === myId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Group by conversationId, pick the latest message and count unread
    const convMap = {};
    for (const msg of myMessages) {
      if (!convMap[msg.conversationId]) {
        let otherId = msg.senderId === myId ? msg.receiverId : msg.senderId;
        if (otherId && typeof otherId === 'string' && otherId.startsWith('ecc_')) {
          otherId = decrypt(otherId);
        }
        const otherUser = await User.findById(otherId).select("name email");
        convMap[msg.conversationId] = {
          conversationId: msg.conversationId,
          otherId,
          otherName: otherUser ? decrypt(otherUser.name) : "Unknown",
          otherEmail: otherUser ? decrypt(otherUser.email) : "",
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: 0,
        };
      }
      if (msg.receiverId === myId && !msg.read) {
        convMap[msg.conversationId].unreadCount += 1;
      }
    }

    res.status(200).json(Object.values(convMap));
  } catch (error) {
    console.error("Error fetching inbox:", error);
    res.status(500).json({ error: "Failed to fetch inbox." });
  }
});

// --- GET /messages/unread-count ---
// Get total unread message count for the logged-in user
router.get("/unread-count", verifyToken, async (req, res) => {
  try {
    const myId = req.user.id;
    const allMessages = await Message.find();

    const count = allMessages.filter(
      (msg) => decrypt(msg.receiverId) === myId && decrypt(msg.read) !== "true"
    ).length;

    res.status(200).json({ count });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ error: "Failed to fetch unread count." });
  }
});

module.exports = router;
