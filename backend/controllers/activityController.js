const express = require("express");
const router = express.Router();
const Activity = require("../models/activityModel");
const { verifyToken } = require("../middleware/authMiddleware");

// Fetch activity logs for the authenticated user
router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id; // Assuming `req.user` contains the authenticated user's ID
    const activities = await Activity.find({ userId }).sort({ timestamp: -1 }).limit(10); // Fetch the last 10 activities
    res.status(200).json(activities);
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

    // Create a new activity
    const newActivity = await Activity.create({
      userId,
      action,
    });

    // Fetch all activities for the user and delete older ones beyond the 10th
    const activities = await Activity.find({ userId }).sort({ timestamp: -1 });
    if (activities.length > 10) {
      const activitiesToDelete = activities.slice(10); // Get activities beyond the 10th
      const activityIdsToDelete = activitiesToDelete.map((activity) => activity._id);
      await Activity.deleteMany({ _id: { $in: activityIdsToDelete } }); // Delete older activities
    }

    res.status(201).json(newActivity);
  } catch (error) {
    console.error("Error creating activity:", error);
    res.status(500).json({ error: "Failed to create activity." });
  }
});

module.exports = router;