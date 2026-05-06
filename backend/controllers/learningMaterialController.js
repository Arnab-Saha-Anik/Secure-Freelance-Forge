const express = require("express");
const LearningMaterial = require("../models/learningMaterialModel");
const User = require("../models/userModel"); // Import the User model
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

// POST: Add a new learning material (Private Access with Token)
router.post("/", verifyToken, async (req, res) => {
  try {
    const { title, description, link } = req.body;

    // Validate input
    if (!title || !description || !link) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Validate the user making the request
    const user = await User.findById(req.user.id); // `req.user` is set by `verifyToken`
    if (!user || user.role.toLowerCase() !== "admin") {
      return res.status(403).json({ error: "Unauthorized. Only admins can add learning materials." });
    }

    // Create a new learning material
    const material = new LearningMaterial({
      title,
      description,
      link,
      postedBy: user._id, // Set the admin's ID as the `postedBy` field
    });

    await material.save();
    res.status(201).json({ message: "Learning material added successfully.", material });
  } catch (err) {
    console.error("Error adding learning material:", err);
    res.status(500).json({ error: "Failed to add learning material." });
  }
});

// GET: Fetch all learning materials
router.get("/", async (req, res) => {
  try {
    const materials = await LearningMaterial.find(); // Fetch all learning materials
    res.status(200).json(materials);
  } catch (err) {
    console.error("Error fetching learning materials:", err);
    res.status(500).json({ error: "Failed to fetch learning materials." });
  }
});

// DELETE: Delete a learning material by ID (Private Access with Token)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate the material ID
    if (!id || id.length !== 24) {
      return res.status(400).json({ error: "Invalid learning material ID." });
    }

    // Validate the user making the request
    const user = await User.findById(req.user.id);
    if (!user || user.role.toLowerCase() !== "admin") {
      return res.status(403).json({ error: "Unauthorized. Only admins can delete learning materials." });
    }

    // Find and delete the learning material
    const material = await LearningMaterial.findByIdAndDelete(id);
    if (!material) {
      return res.status(404).json({ error: "Learning material not found." });
    }

    res.status(200).json({ message: "Learning material deleted successfully." });
  } catch (err) {
    console.error("Error deleting learning material:", err);
    res.status(500).json({ error: "Failed to delete learning material." });
  }
});

module.exports = router;