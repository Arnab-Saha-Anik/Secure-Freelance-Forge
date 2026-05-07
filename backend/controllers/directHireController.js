const express = require("express");
const DirectHire = require("../models/directHireModel");
const Project = require("../models/projectModel");
const Notification = require("../models/notificationModel");
const User = require("../models/userModel");
const { verifyToken } = require("../middleware/authMiddleware");
const Activity = require("../models/activityModel"); // Import the Activity model
const Bid = require("../models/bidModel"); // Import the Bid model
// Modified: Use RSA for User/FreelancerInformation and ECC for others
const { eccEncrypt, eccDecrypt, rsaDecrypt, decrypt } = require("../utils/cryptoUtils");

const router = express.Router();

// Route to create a direct hire
router.post("/", verifyToken, async (req, res) => {
  const { freelancerId, projectId } = req.body;

  try {
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }
    if (decrypt(project.escrowStatus) === "Not Funded") {
      return res.status(400).json({ error: "Escrow must be funded before creating a direct hire." });
    }
    // Check project status - Modified: Decrypt status for comparison
    if (decrypt(project.status) === "accepted") {
      return res.status(400).json({
        error: "Direct hire is not allowed as the project is already accepted.",
      });
    }

    // Check if a direct hire already exists
    const allDirectHires = await DirectHire.find();
    const existingDirectHire = allDirectHires.find(dh => 
      decrypt(dh.projectId) === projectId && 
      decrypt(dh.freelancerId) === freelancerId && 
      decrypt(dh.clientId) === req.user.id
    );
    if (existingDirectHire) {
      return res.status(400).json({
        error: "A direct hire already exists for this freelancer and project.",
      });
    }

    const directHire = new DirectHire({
      freelancerId: eccEncrypt(freelancerId),
      clientId: eccEncrypt(req.user.id),
      projectId: eccEncrypt(projectId),
    });

    await directHire.save();

    const freelancer = await User.findById(freelancerId).select("email");
    const decryptedEmail = rsaDecrypt(freelancer.email);

    // Log the activity
    const decryptedTitle = eccDecrypt(project.title);
    await Activity.create({
      userId: eccEncrypt(req.user.id),
      action: eccEncrypt(`You have offered a direct hire to freelancer (${decryptedEmail}) for the project "${decryptedTitle}".`),
    });

    // Notify the freelancer
    await Notification.create({
      user: eccEncrypt(freelancerId),
      message: eccEncrypt(`You have been offered to be hired for the project "${decryptedTitle}".`),
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
    const allDirectHires = await DirectHire.find();
    
    const directHires = allDirectHires.filter(dh => decrypt(dh.clientId) === req.user.id);
    
    // Fetch info manually since population is broken for encrypted IDs
    const decryptedDirectHires = await Promise.all(directHires.map(async (dh) => {
      const freelancer = await User.findById(decrypt(dh.freelancerId)).select("name email");
      const project = await Project.findById(decrypt(dh.projectId)).select("title description");
      
      return {
        ...dh.toObject(),
        freelancerId: freelancer ? {
          ...freelancer.toObject(),
          name: rsaDecrypt(freelancer.name),
          email: rsaDecrypt(freelancer.email),
        } : null,
        projectId: project ? {
          ...project.toObject(),
          title: eccDecrypt(project.title),
          description: eccDecrypt(project.description),
        } : null,
      };
    }));

    res.status(200).json(decryptedDirectHires);
  } catch (error) {
    console.error("Error fetching direct hires for client:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get Direct Hires for a Freelancer (Pending and Selected)
router.get("/freelancer", verifyToken, async (req, res) => {
  try {
    const allDirectHires = await DirectHire.find();
    
    const directHires = allDirectHires.filter(dh => decrypt(dh.freelancerId) === req.user.id);

    // Modified: Decrypt mixed data (User: RSA, Project: ECC)
    const decryptedDirectHires = await Promise.all(directHires.map(async (dh) => {
      const decryptedProjectId = decrypt(dh.projectId);
      const project = await Project.findById(decryptedProjectId);
      
      // Filter by status manually
      if (!project || !["pending", "selected"].includes(decrypt(project.status))) {
        return null;
      }

      const client = await User.findById(decrypt(dh.clientId)).select("name email");
      return {
        ...dh.toObject(),
        clientId: client ? {
          ...client.toObject(),
          name: rsaDecrypt(client.name),
          email: rsaDecrypt(client.email),
        } : null,
        projectId: {
          ...project.toObject(),
          title: eccDecrypt(project.title),
          description: eccDecrypt(project.description),
          budget: eccDecrypt(project.budget),
          deadline: eccDecrypt(project.deadline),
        },
      };
    }));

    res.status(200).json(decryptedDirectHires.filter(dh => dh !== null));
  } catch (error) {
    console.error("Error fetching direct hires for freelancer:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get Direct Hire Details by Project ID
router.get("/details/:projectId", verifyToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    const allDirectHires = await DirectHire.find();
    const directHire = allDirectHires.find(dh => 
      decrypt(dh.projectId) === projectId && decrypt(dh.freelancerId) === req.user.id
    );

    if (!directHire) {
      return res.status(404).json({ error: "Direct hire record not found." });
    }

    const project = await Project.findById(projectId);
    const client = await User.findById(decrypt(directHire.clientId)).select("name email");

    res.status(200).json({
      project: project ? {
        ...project.toObject(),
        title: eccDecrypt(project.title),
        description: eccDecrypt(project.description),
        budget: eccDecrypt(project.budget),
        deadline: eccDecrypt(project.deadline),
      } : null,
      client: client,
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
    const directHire = await DirectHire.findById(id);

    if (!directHire) {
      return res.status(404).json({ error: "Direct hire record not found." });
    }

    const decryptedProjectId = decrypt(directHire.projectId);
    const project = await Project.findById(decryptedProjectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    // Update the project status to "accepted" and store the accepted freelancer and budget
    await Project.findByIdAndUpdate(decryptedProjectId, {
      status: eccEncrypt("accepted"),
      acceptedFreelancer: directHire.freelancerId, // Already encrypted
      acceptedmoney: project.budget, // Already encrypted
    });

    // Delete all other direct hires for the project
    const allDirectHires = await DirectHire.find();
    const otherDirectHires = allDirectHires.filter(dh => decrypt(dh.projectId) === decryptedProjectId);
    await Promise.all(otherDirectHires.map(dh => dh.deleteOne()));

    // Delete all bids for the project
    const allBids = await Bid.find();
    const otherBids = allBids.filter(b => decrypt(b.projectId) === decryptedProjectId);
    await Promise.all(otherBids.map(b => b.deleteOne()));

    const freelancerId = decrypt(directHire.freelancerId);
    const freelancer = await User.findById(freelancerId);

    // Log the activity for the freelancer
    await Activity.create({
      userId: directHire.freelancerId, // Already encrypted
      action: eccEncrypt(`You accepted the direct hire for project "${decrypt(project.title)}".`),
    });

    // Log the activity for the client
    await Activity.create({
      userId: directHire.clientId, // Already encrypted
      action: eccEncrypt(`Freelancer (${rsaDecrypt(freelancer.email)}) accepted your direct hire for project "${decrypt(project.title)}".`),
    });

    // Notify the client
    await Notification.create({
      user: directHire.clientId, // Already encrypted
      message: eccEncrypt(`Freelancer (${rsaDecrypt(freelancer.email)}) has accepted your project "${decrypt(project.title)}".`),
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
    const directHire = await DirectHire.findById(id);

    if (!directHire) {
      return res.status(404).json({ error: "Direct hire record not found." });
    }

    if (decrypt(directHire.freelancerId) !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to reject this project." });
    }

    const decryptedProjectId = decrypt(directHire.projectId);
    const project = await Project.findById(decryptedProjectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    const freelancer = await User.findById(req.user.id).select("email");

    // Log the activity for the freelancer
    await Activity.create({
      userId: directHire.freelancerId, // Already encrypted
      action: eccEncrypt(`You rejected the direct hire for project "${decrypt(project.title)}".`),
    });

    // Log the activity for the client
    await Activity.create({
      userId: directHire.clientId, // Already encrypted
      action: eccEncrypt(`Freelancer (${rsaDecrypt(freelancer.email)}) rejected your direct hire for project "${decrypt(project.title)}".`),
    });

    // Notify the client
    await Notification.create({
      user: directHire.clientId, // Already encrypted
      message: eccEncrypt(`Freelancer (${rsaDecrypt(freelancer.email)}) has rejected your hire offer for the project "${decrypt(project.title)}".`),
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