const express = require("express");
const router = express.Router();
const Notification = require("../models/notificationModel");
const { verifyToken } = require("../middleware/authMiddleware");
const { eccDecrypt, decrypt } = require("../utils/cryptoUtils");

// Fetch notifications for the logged-in user
router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const allNotifications = await Notification.find().sort({ createdAt: -1 });
    const notifications = allNotifications.filter(n => decrypt(n.user) === userId);

    // Modified: Decrypt notification messages before sending to the client
    const decryptedNotifications = notifications.map(notification => ({
      ...notification.toObject(),
      message: eccDecrypt(notification.message),
    }));

    res.status(200).json(decryptedNotifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Mark all notifications as read
router.put("/mark-as-read", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const allNotifications = await Notification.find({ read: false });
    const userNotifications = allNotifications.filter(n => decrypt(n.user) === userId);
    const notificationIds = userNotifications.map(n => n._id);
    await Notification.updateMany({ _id: { $in: notificationIds } }, { read: true });
    res.status(200).json({ message: "Notifications marked as read." });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a specific notification
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification || decrypt(notification.user) !== req.user.id) {
      return res.status(404).json({ error: "Notification not found or unauthorized" });
    }

    await Notification.findByIdAndDelete(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.status(200).json({ message: "Notification deleted successfully." });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;