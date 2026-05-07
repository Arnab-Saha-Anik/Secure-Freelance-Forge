const express = require("express");
const router = express.Router();
const Activity = require("../models/activityModel");
const { verifyToken } = require("../middleware/authMiddleware");
const { eccEncrypt, eccDecrypt, decrypt } = require("../utils/cryptoUtils");

// Fetch activity logs for the authenticated user
router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const allActivities = await Activity.find().sort({ timestamp: -1 });
    const activities = allActivities.filter(activity => decrypt(activity.userId) === userId).slice(0, 10);
    
    // Modified: Decrypt activity actions before sending to the client
    const decryptedActivities = activities.map(activity => ({
      ...activity.toObject(),
      action: eccDecrypt(activity.action),
    }));

    res.status(200).json(decryptedActivities);
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ error: "Failed to fetch activity logs." });
  }
});

// Add a new activity and ensure only the latest 10 are retained
router.post("/", verifyToken, async (req, res) => {
  try {
    const { action } = req.body;
    const userId = req.user.id;

    // Modified: Encrypt activity action and userId before storage
    const newActivity = await Activity.create({
      userId: eccEncrypt(userId),
      action: eccEncrypt(action),
    });

    // Fetch all activities for the user and delete older ones beyond the 10th
    const allActivitiesForUser = await Activity.find().sort({ timestamp: -1 });
    const activities = allActivitiesForUser.filter(activity => decrypt(activity.userId) === userId);
    if (activities.length > 10) {
      const activitiesToDelete = activities.slice(10);
      const activityIdsToDelete = activitiesToDelete.map((activity) => activity._id);
      await Activity.deleteMany({ _id: { $in: activityIdsToDelete } });
    }

    // Modified: Decrypt action for the response
    res.status(201).json({
      ...newActivity.toObject(),
      action: eccDecrypt(newActivity.action),
    });
  } catch (error) {
    console.error("Error creating activity:", error);
    res.status(500).json({ error: "Failed to create activity." });
  }
});

module.exports = router;