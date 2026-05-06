const express = require("express");
const DirectHire = require("../models/directHireModel");
const Project = require("../models/projectModel");
const Notification = require("../models/notificationModel");
const User = require("../models/userModel");
const { verifyToken } = require("../middleware/authMiddleware");
const Activity = require("../models/activityModel"); // Import the Activity model
const Bid = require("../models/bidModel"); // Import the Bid model

const router = express.Router();

// Route to create a direct hire
router.post("/", verifyToken, async (req, res) => {
  const { freelancerId, projectId } = req.body;

  try {
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }
    if (project.escrowStatus === "Not Funded") {
      return res.status(400).json({ error: "Escrow must be funded before creating a direct hire." });
    }
    // Check project status
    if (project.status === "accepted") {
      return res.status(400).json({
        error: "Direct hire is not allowed as the project is already accepted.",
      });
    }

    // Check if a direct hire already exists
    const existingDirectHire = await DirectHire.findOne({ freelancerId, clientId: req.user.id, projectId });
    if (existingDirectHire) {
      return res.status(400).json({
        error: "A direct hire already exists for this freelancer and project.",
      });
    }

    const directHire = new DirectHire({
      freelancerId,
      clientId: req.user.id,
      projectId,
    });

    await directHire.save();

    const freelancer = await User.findById(freelancerId).select("email");

    // Log the activity
    await Activity.create({
      userId: req.user.id,
      action: `You have offered a direct hire to freelancer (${freelancer.email}) for the project "${project.title}".`,
    });

    // Notify the freelancer
    await Notification.create({
      user: freelancerId,
      projectId: projectId,
      message: `You have been offered to be hired for the project "${project.title}".`,
    });

    res.status(200).json({ message: "Freelancer has been offered to hire successfully.", directHire });
  } catch (error) {
    console.error("Error in /direct-hire:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get Direct Hires for a Client
router.get("/client", verifyToken, async (req, res) => {
  try {
    const directHires = await DirectHire.find({ clientId: req.user.id })
      .populate("freelancerId", "name email")
      .populate("projectId", "title description");

    res.status(200).json(directHires);
  } catch (error) {
    console.error("Error fetching direct hires for client:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get Direct Hires for a Freelancer (Pending and Selected)
router.get("/freelancer", verifyToken, async (req, res) => {
  try {
    const directHires = await DirectHire.find({ freelancerId: req.user.id })
      .populate({
        path: "projectId",
        match: { status: { $in: ["pending", "selected"] } }, // Match projects with status "pending" or "selected"
        select: "title description budget deadline client",
      })
      .populate("clientId", "name email");

    const filteredDirectHires = directHires.filter((directHire) => directHire.projectId !== null);

    res.status(200).json(filteredDirectHires);
  } catch (error) {
    console.error("Error fetching direct hires for freelancer:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get Direct Hire Details by Project ID
router.get("/details/:projectId", verifyToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    const directHire = await DirectHire.findOne({ projectId, freelancerId: req.user.id })
      .populate("clientId", "name email")
      .populate("projectId", "title description budget deadline");

    if (!directHire) {
      return res.status(404).json({ error: "Direct hire record not found." });
    }

    res.status(200).json({
      project: directHire.projectId,
      client: directHire.clientId,
    });
  } catch (error) {
    console.error("Error fetching direct hire details:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Route to accept a direct hire
router.put("/accept/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const directHire = await DirectHire.findById(id).populate("projectId freelancerId");

    if (!directHire) {
      return res.status(404).json({ error: "Direct hire record not found." });
    }

    const projectId = directHire.projectId._id;

    // Update the project status to "accepted" and store the accepted freelancer and budget
    await Project.findByIdAndUpdate(projectId, {
      status: "accepted",
      acceptedFreelancer: directHire.freelancerId._id,
      acceptedmoney: directHire.projectId.budget,
    });

    // Delete all other direct hires for the project
    await DirectHire.deleteMany({ projectId });

    // Delete all bids for the project
    await Bid.deleteMany({ projectId });

    // Log the activity for the freelancer
    await Activity.create({
      userId: directHire.freelancerId._id,
      action: `You accepted the direct hire for project "${directHire.projectId.title}".`,
    });

    // Log the activity for the client
    await Activity.create({
      userId: directHire.clientId._id,
      action: `Freelancer (${directHire.freelancerId.email}) accepted your direct hire for project "${directHire.projectId.title}".`,
    });

    // Notify the client
    await Notification.create({
      user: directHire.clientId._id,
      message: `Freelancer (${directHire.freelancerId.email}) has accepted your project "${directHire.projectId.title}".`,
    });

    res.status(200).json({ message: "Direct hire accepted successfully." });
  } catch (error) {
    console.error("Error accepting direct hire:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Reject Direct Hire
router.delete("/reject/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    const directHire = await DirectHire.findById(id).populate("projectId").populate("clientId");

    if (!directHire) {
      return res.status(404).json({ error: "Direct hire record not found." });
    }

    if (directHire.freelancerId.toString() !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to reject this project." });
    }

    const freelancer = await User.findById(req.user.id).select("email");

    // Log the activity for the freelancer
    await Activity.create({
      userId: req.user.id,
      action: `You rejected the direct hire for project "${directHire.projectId.title}".`,
    });

    // Log the activity for the client
    await Activity.create({
      userId: directHire.clientId._id,
      action: `Freelancer (${freelancer.email}) rejected your direct hire for project "${directHire.projectId.title}".`,
    });

    // Notify the client
    await Notification.create({
      user: directHire.clientId._id,
      message: `Freelancer (${freelancer.email}) has rejected your hire offer for the project "${directHire.projectId.title}".`,
    });

    // Delete the direct hire record
    await DirectHire.findByIdAndDelete(id);

    res.status(200).json({ message: "Project rejected successfully." });
  } catch (error) {
    console.error("Error rejecting direct hire:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;