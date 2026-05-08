const express = require("express");
const router = express.Router();
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const { verifyToken } = require("../middleware/authMiddleware");
const { eccEncrypt, decrypt } = require("../utils/cryptoUtils");
const { generateMessageMac, verifyMessageMac } = require("../utils/mac");

const buildConversationId = (id1, id2) => [id1, id2].sort().join("_");

const normalizeMessageWithMac = async (msg, conversationId) => {
  const senderId = decrypt(msg.senderId);
  const receiverId = decrypt(msg.receiverId);
  const content = decrypt(msg.content);
  const macParts = [conversationId, senderId, receiverId, content];

  if (!msg.mac) {
    const mac = generateMessageMac(macParts);
    await Message.updateOne({ _id: msg._id }, { $set: { mac } });
    return {
      _id: msg._id,
      conversationId,
      senderId,
      receiverId,
      content,
      read: decrypt(msg.read) === "true",
      mac,
      macValid: true,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    };
  }

  return {
    _id: msg._id,
    conversationId,
    senderId,
    receiverId,
    content,
    read: decrypt(msg.read) === "true",
    mac: msg.mac,
    macValid: verifyMessageMac(macParts, msg.mac),
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
  };
};

router.post("/send", verifyToken, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    const senderId = req.user.id;
    const decryptedReceiverId = decrypt(receiverId);

    if (!decryptedReceiverId || !content || !content.trim()) {
      return res.status(400).json({ error: "receiverId and content are required." });
    }

    const receiver = await User.findById(decryptedReceiverId);
    if (!receiver) {
      return res.status(404).json({ error: "Receiver not found." });
    }

    const trimmedContent = content.trim();
    const conversationId = buildConversationId(senderId, decryptedReceiverId);
    const mac = generateMessageMac([conversationId, senderId, decryptedReceiverId, trimmedContent]);

    const message = await Message.create({
      conversationId: eccEncrypt(conversationId),
      senderId: eccEncrypt(senderId),
      receiverId: eccEncrypt(decryptedReceiverId),
      content: eccEncrypt(trimmedContent),
      mac,
      read: eccEncrypt("false"),
    });

    res.status(201).json({
      _id: message._id,
      conversationId,
      senderId,
      receiverId: decryptedReceiverId,
      content: trimmedContent,
      read: message.read,
      createdAt: message.createdAt,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message." });
  }
});

router.get("/conversation/:otherId", verifyToken, async (req, res) => {
  try {
    const { otherId } = req.params;
    const myId = req.user.id;
    const conversationId = buildConversationId(myId, otherId);
    const [myUser, otherUser] = await Promise.all([
      User.findById(myId).select("name"),
      User.findById(otherId).select("name"),
    ]);

    const allMessages = await Message.find();

    const conversation = [];
    for (const msg of allMessages) {
      if (decrypt(msg.conversationId) === conversationId) {
        const normalized = await normalizeMessageWithMac(msg, conversationId);
        conversation.push({
          ...normalized,
          senderName: normalized.senderId === myId ? (myUser ? decrypt(myUser.name) : "You") : (otherUser ? decrypt(otherUser.name) : "Unknown"),
          receiverName: normalized.receiverId === myId ? (myUser ? decrypt(myUser.name) : "You") : (otherUser ? decrypt(otherUser.name) : "Unknown"),
        });
      }
    }

    conversation.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const tamperedMessage = conversation.find((msg) => msg.macValid === false);
    console.log(`[DEBUG] /conversation/:otherId - Found ${conversation.length} messages. Tampered: ${!!tamperedMessage}`);

    if (tamperedMessage) {
      return res.status(409).json({ error: "Message integrity check failed." });
    }

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

router.get("/inbox", verifyToken, async (req, res) => {
  try {
    const myId = req.user.id;
    const allMessages = await Message.find();

    const myMessages = [];
    for (const msg of allMessages) {
      const conversationId = decrypt(msg.conversationId);
      const senderId = decrypt(msg.senderId);
      const receiverId = decrypt(msg.receiverId);

      if (senderId === myId || receiverId === myId) {
        myMessages.push(await normalizeMessageWithMac(msg, conversationId));
      }
    }

    myMessages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (myMessages.some((msg) => msg.macValid === false)) {
      return res.status(409).json({ error: "Message integrity check failed." });
    }

    const convMap = {};
    for (const msg of myMessages) {
      if (!convMap[msg.conversationId]) {
        let otherId = msg.senderId === myId ? msg.receiverId : msg.senderId;
        if (otherId && typeof otherId === "string" && otherId.startsWith("ecc_")) {
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