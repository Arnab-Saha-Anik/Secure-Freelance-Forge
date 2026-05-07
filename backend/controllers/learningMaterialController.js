const express = require("express");
const LearningMaterial = require("../models/learningMaterialModel");
const User = require("../models/userModel"); // Import the User model
const { verifyToken } = require("../middleware/authMiddleware");
const { eccEncrypt, eccDecrypt, rsaDecrypt } = require("../utils/cryptoUtils");

const router = express.Router();

// POST: Add a new learning material (Private Access with Token)
router.post("/", verifyToken, async (req, res) => {
  try {
    const { title, description, link } = req.body;

    // Validate input
    if (!title || !description || !link) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Modified: Decrypt role for admin check
    const user = await User.findById(req.user.id);
    if (!user || rsaDecrypt(user.role).toLowerCase() !== "admin") {
      return res.status(403).json({ error: "Unauthorized. Only admins can add learning materials." });
    }

    // Modified: Encrypt title, description, and link before saving
    const material = new LearningMaterial({
      title: eccEncrypt(title),
      description: eccEncrypt(description),
      link: eccEncrypt(link),
      postedBy: eccEncrypt(user._id.toString()), // Set the admin's ID as the `postedBy` field
    });

    await material.save();
    // Modified: Decrypt for response
    res.status(201).json({ 
      message: "Learning material added successfully.", 
      material: {
        ...material.toObject(),
        title: eccDecrypt(material.title),
        description: eccDecrypt(material.description),
        link: eccDecrypt(material.link),
      } 
    });
  } catch (err) {
    console.error("Error adding learning material:", err);
    res.status(500).json({ error: "Failed to add learning material." });
  }
});

// GET: Fetch all learning materials
router.get("/", async (req, res) => {
  try {
    const materials = await LearningMaterial.find(); // Fetch all learning materials
    
    // Modified: Decrypt all fields before sending to the client
    const decryptedMaterials = materials.map(material => ({
      ...material.toObject(),
      title: eccDecrypt(material.title),
      description: eccDecrypt(material.description),
      link: eccDecrypt(material.link),
    }));

    res.status(200).json(decryptedMaterials);
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

    // Modified: Decrypt role for admin check
    const user = await User.findById(req.user.id);
    if (!user || rsaDecrypt(user.role).toLowerCase() !== "admin") {
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