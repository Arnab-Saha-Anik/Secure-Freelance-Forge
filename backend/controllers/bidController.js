const express = require("express");
const router = express.Router();
const Bid = require("../models/bidModel");
const Notification = require("../models/notificationModel");
const { verifyToken } = require("../middleware/authMiddleware");
const Project = require("../models/projectModel");
const User = require("../models/userModel");
const Activity = require("../models/activityModel");
const DirectHire = require("../models/directHireModel");
const Review = require("../models/reviewModel");
const FreelancerInformation = require("../models/freelancerInformationModel");
// Modified: Use unified decrypt helper to handle mixed RSA/ECC data
const { eccEncrypt, eccDecrypt, rsaDecrypt, decrypt } = require('../utils/cryptoUtils');

// Route to fetch accepted bids
router.get("/accepted", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id; // Assuming `verifyToken` adds `user` to `req`
    const allBids = await Bid.find({ status: "accepted" });
    
    // Modified: Filter by decrypted freelancerId and decrypt projects
    const filteredBids = allBids.filter(b => decrypt(b.freelancerId) === userId);
    
    const decryptedBids = await Promise.all(filteredBids.map(async (bid) => {
      const decryptedProjectId = decrypt(bid.projectId);
      const project = await Project.findById(decryptedProjectId).select("title client");
      
      return {
        ...bid.toObject(),
        projectId: project ? {
          ...project.toObject(),
          title: decrypt(project.title),
          client: project.client, // Keep encrypted client ID
        } : null,
        amount: decrypt(bid.amount),
      };
    }));

    res.status(200).json(decryptedBids);
  } catch (error) {
    console.error("Error fetching accepted bids:", error);
    res.status(500).json({ error: "Failed to fetch accepted bids" });
  }
});

// Route to fetch selected bids for the freelancer
router.get("/selected", verifyToken, async (req, res) => {
  try {
    const freelancerId = req.user.id; // Assuming `verifyToken` adds `user` to `req`

    // Fetch all bids and filter manually because encrypted projectId/freelancerId breaks DB matching
    const allBids = await Bid.find();

    const selectedBids = [];
    for (const bid of allBids) {
      if (decrypt(bid.freelancerId) === freelancerId) {
        const decryptedProjectId = decrypt(bid.projectId);
        const project = await Project.findById(decryptedProjectId).select("title description budget deadline client status");
        
        if (project && decrypt(project.status) === "selected") {
          // Manually populate client for the project
          const decryptedClientId = decrypt(project.client);
          const clientUser = await User.findById(decryptedClientId).select("name email");
          
          const bidObj = bid.toObject();
          bidObj.projectId = project.toObject();
          bidObj.projectId.client = clientUser;
          selectedBids.push(bidObj);
        }
      }
    }

    // Filter out bids where the project does not match the "selected" status
    const filteredBids = selectedBids.filter((bid) => bid.projectId !== null);

    if (filteredBids.length === 0) {
      return res.status(404).json({ error: "No selected bids available." });
    }

    // Modified: Decrypt projects for selected bids using unified decrypt
    const formattedBids = filteredBids.map((bid) => ({
      bidId: bid._id,
      bidAmount: decrypt(bid.amount),
      project: {
        title: decrypt(bid.projectId.title),
        description: decrypt(bid.projectId.description),
        budget: decrypt(bid.projectId.budget),
        deadline: decrypt(bid.projectId.deadline),
      },
      client: {
        name: rsaDecrypt(bid.projectId.client?.name || ""), // Explicitly RSA for User
        email: rsaDecrypt(bid.projectId.client?.email || ""), // Explicitly RSA for User
      },
    }));

    res.status(200).json(formattedBids);
  } catch (error) {
    console.error("Error fetching selected bids:", error);
    res.status(500).json({ error: "Failed to fetch selected bids." });
  }
});

// Route to fetch bids for a specific project
router.get("/:projectId", verifyToken, async (req, res) => {
  try {
    const allBids = await Bid.find();
    const bids = allBids.filter(b => decrypt(b.projectId) === req.params.projectId);
    
    // Modified: Manually fetch freelancer info since ref is broken
    const enhancedBids = await Promise.all(
      bids.map(async (bid) => {
        const decryptedFreelancerId = decrypt(bid.freelancerId);
        const freelancer = await User.findById(decryptedFreelancerId).select("name email");
        if (!freelancer) return null;

        // Calculate average rating
        let avgRating = 0;
        const allReviews = await Review.find();
        const reviews = allReviews.filter(r => decrypt(r.receiverId) === decryptedFreelancerId);
        if (reviews.length > 0) {
          avgRating = reviews.reduce((sum, r) => sum + parseInt(decrypt(r.rating)), 0) / reviews.length;
        }

        // Fetch freelancer information
        const allFreelancerInfo = await FreelancerInformation.find();
        const freelancerInfo = allFreelancerInfo.find(fi => decrypt(fi.userId) === decryptedFreelancerId);

        return {
          ...bid.toObject(),
          amount: decrypt(bid.amount),
          freelancerId: {
            ...freelancer.toObject(),
            name: rsaDecrypt(freelancer.name),
            email: rsaDecrypt(freelancer.email),
            avgRating: avgRating ? avgRating.toFixed(1) : "0",
            profile: freelancerInfo
              ? [{
                  skills: Array.isArray(freelancerInfo.skills)
                    ? freelancerInfo.skills.map(s => rsaDecrypt(s ?? ""))
                    : [],
                  portfolio: rsaDecrypt(freelancerInfo.portfolio ?? ""),
                  experience: rsaDecrypt(freelancerInfo.experience ?? ""),
                }]
              : [],
          },
        };
      })
    );

    res.status(200).json(enhancedBids.filter(b => b !== null));
  } catch (error) {
    console.error("Error fetching bids:", error);
    res.status(500).json({ error: "Failed to fetch bids" });
  }
});

// Route to fetch a freelancer's bid for a specific project
router.get("/:projectId/my-bid", verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const freelancerId = req.user.id; // Assuming `verifyToken` adds `user` to `req`

    const allBids = await Bid.find();
    const bidsForProject = allBids.filter(b => decrypt(b.projectId) === projectId);
    const bid = bidsForProject.find(b => decrypt(b.freelancerId) === freelancerId);
    if (!bid) {
      return res.status(404).json({ error: "No bid found for this project." });
    }

    res.status(200).json({
      ...bid.toObject(),
      amount: eccDecrypt(bid.amount),
    });
  } catch (error) {
    console.error("Error fetching bid:", error);
    res.status(500).json({ error: "Failed to fetch bid." });
  }
});

// Route to create a new bid
router.post("/:projectId/bid", verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { bidAmount } = req.body;
    const freelancerId = req.user.id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check project status
    if (decrypt(project.status) === "accepted") {
      return res.status(400).json({
        error: "Bidding is not allowed as the project is already accepted.",
      });
    }

    // Check if the freelancer has already submitted a bid for this project
    const allBids = await Bid.find();
    const existingBid = allBids.find(b => decrypt(b.projectId) === projectId && decrypt(b.freelancerId) === freelancerId);
    if (existingBid) {
      return res.status(400).json({ error: "You have already submitted a bid for this project." });
    }

    // Modified: Encrypt projectId, bid amount and freelancerId
    const newBid = await Bid.create({
      projectId: eccEncrypt(projectId),
      freelancerId: eccEncrypt(freelancerId),
      amount: eccEncrypt(bidAmount.toString()),
    });

    const freelancer = await User.findById(req.user.id).select("email");

    // Modified: Decrypt title for notification/log and encrypt messages and userId
    const decryptedTitle = decrypt(project.title);
    await Activity.create({
      userId: eccEncrypt(freelancerId),
      action: eccEncrypt(`You placed a bid of $${bidAmount} on project "${decryptedTitle}".`),
    });

    await Notification.create({
      user: project.client, // Already encrypted
      message: eccEncrypt(`A new bid of $${bidAmount} has been placed on your project "${decryptedTitle}".`),
    });

    res.status(201).json({ message: "Bid submitted successfully.", bid: newBid });
  } catch (error) {
    console.error("Error submitting bid:", error);
    res.status(500).json({ error: "Failed to submit bid" });
  }
});

// Route to select a bid
router.put("/select/:bidId", verifyToken, async (req, res) => {
  try {
    const { bidId } = req.params;

    const bid = await Bid.findById(bidId);
    if (!bid) {
      return res.status(404).json({ error: "Bid not found" });
    }

    // Manually fetch project and freelancer info
    const decryptedProjectId = decrypt(bid.projectId);
    const project = await Project.findById(decryptedProjectId);
    const freelancer = await User.findById(decrypt(bid.freelancerId));

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if escrow is funded - Modified: Decrypt for comparison
    if (decrypt(project.escrowStatus) === "Not Funded") {
      return res.status(400).json({ error: "Escrow must be funded before selecting a bid." });
    }

    // Update the project status to "selected" - Modified: Encrypt status
    project.status = eccEncrypt("selected");
    await project.save();

    // Notify the freelancer - Modified: Decrypt ID and message
    await Notification.create({
      user: decrypt(bid.freelancerId),
      message: eccEncrypt(`Your bid of $${decrypt(bid.amount)} for the project "${decrypt(project.title)}" has been selected.`),
    });

    // Log the activity for the client - Modified: Decrypt IDs and messages
    const decryptedClient = decrypt(project.client);
    await Activity.create({
      userId: eccEncrypt(decryptedClient),
      action: eccEncrypt(`You selected the bid of $${decrypt(bid.amount)} for the project "${decrypt(project.title)}" to the freelancer (${rsaDecrypt(freelancer.email)}).`),
    });

    res.status(200).json({ message: "Bid selected successfully.", bid });
  } catch (error) {
    console.error("Error selecting bid:", error);
    res.status(500).json({ error: "Failed to select bid." });
  }
});

// Route to accept a selected bid
router.put("/accept/:bidId", verifyToken, async (req, res) => {
  try {
    const { bidId } = req.params;

    const bid = await Bid.findById(bidId);
    if (!bid) {
      return res.status(404).json({ error: "Bid not found" });
    }

    const decryptedProjectId = decrypt(bid.projectId);
    const project = await Project.findById(decryptedProjectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Update the project status to "accepted" and store the accepted freelancer and bid amount
    await Project.findByIdAndUpdate(decryptedProjectId, {
      status: eccEncrypt("accepted"),
      acceptedFreelancer: bid.freelancerId, // Already encrypted
      acceptedmoney: bid.amount, // Already encrypted
    });

    // Delete all other bids for the project
    const allBids = await Bid.find();
    const otherBids = allBids.filter(b => decrypt(b.projectId) === decryptedProjectId);
    await Promise.all(otherBids.map(b => b.deleteOne()));

    // Delete all direct hires for the project
    const allDirectHires = await DirectHire.find();
    const otherDirectHires = allDirectHires.filter(dh => decrypt(dh.projectId) === decryptedProjectId);
    await Promise.all(otherDirectHires.map(dh => dh.deleteOne()));

    const freelancerId = decrypt(bid.freelancerId);
    const freelancer = await User.findById(freelancerId);

    // Log the activity
    await Activity.create({
      userId: eccEncrypt(freelancerId),
      action: eccEncrypt(`You accepted the project "${decrypt(project.title)}" for $${decrypt(bid.amount)}.`),
    });

    // Notify the client
    await Notification.create({
      user: project.client, // Already encrypted
      message: eccEncrypt(`${rsaDecrypt(freelancer.email)} has accepted the project "${decrypt(project.title)}" for $${decrypt(bid.amount)}.`),
    });

    res.status(200).json({ message: "Bid accepted successfully.", bid });
  } catch (error) {
    console.error("Error accepting bid:", error);
    res.status(500).json({ error: "Failed to accept bid." });
  }
});

// Route to reject a selected bid
router.delete("/reject/:bidId", verifyToken, async (req, res) => {
  try {
    const { bidId } = req.params;

    const decryptedProjectId = decrypt(bid.projectId);
    const project = await Project.findById(decryptedProjectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    // Ensure the project status is not "accepted"
    if (decrypt(project.status) === "accepted") {
      return res.status(400).json({ error: "The bid has already been accepted and cannot be rejected." });
    }

    // Delete the bid
    await bid.deleteOne();

    // Check if there are any remaining bids for the project
    const allBids = await Bid.find();
    const remainingBids = allBids.filter(b => decrypt(b.projectId) === decryptedProjectId);
    
    if (remainingBids.length === 0 && decrypt(project.status) === "selected") {
      // If no bids are left, update the project status to "pending"
      project.status = eccEncrypt("pending");
      await project.save();
    }

    // Notify the client
    await Notification.create({
      user: project.client, // Already encrypted
      message: eccEncrypt(`The selected bid for your project "${decrypt(project.title)}" has been rejected by the freelancer.`),
    });

    // Log the activity for the freelancer
    await Activity.create({
      userId: bid.freelancerId, // Already encrypted
      action: eccEncrypt(`You have rejected the bid for the project "${decrypt(project.title)}".`),
    });

    res.status(200).json({ message: "Bid rejected successfully." });
  } catch (error) {
    console.error("Error rejecting bid:", error);
    res.status(500).json({ error: "Failed to reject bid." });
  }
});

// Route to update a bid
router.put("/:bidId", verifyToken, async (req, res) => {
  try {
    const { bidId } = req.params;
    const { bidAmount } = req.body;
    const freelancerId = req.user.id;

    const bid = await Bid.findById(bidId);
    if (!bid || decrypt(bid.freelancerId) !== freelancerId) {
      return res.status(404).json({ error: "Bid not found or you are not authorized to update this bid." });
    }

    const decryptedProjectId = decrypt(bid.projectId);
    const project = await Project.findById(decryptedProjectId);

    const allBids = await Bid.find();
    const myBid = allBids.find(b => decrypt(b.projectId) === decryptedProjectId && decrypt(b.freelancerId) === freelancerId && b._id.toString() === bidId);

    if (project && decrypt(project.status) === "selected" && myBid) {
      return res.status(400).json({
        error: "Bid update is not allowed as your bid has already been selected.",
      });
    }

    // Update the bid - Modified: Encrypt amount
    bid.amount = eccEncrypt(bidAmount.toString());
    await bid.save();

    const clientUser = await User.findById(decrypt(project.client)).select("email");

    // Log the activity - Modified: Encrypt userId and messages
    await Activity.create({
      userId: eccEncrypt(freelancerId),
      action: eccEncrypt(`You updated your bid to $${bidAmount} for project "${decrypt(project.title)}".`),
    });

    // Create a notification for the client
    await Notification.create({
      user: project.client, // Already encrypted
      message: eccEncrypt(`A freelancer has updated their bid for project "${decrypt(project.title)}".`),
    });

    res.status(200).json({ message: "Bid updated successfully.", bid });
  } catch (error) {
    console.error("Error updating bid:", error);
    res.status(500).json({ error: "Failed to update bid." });
  }
});

// Route to delete a bid
router.delete("/:bidId", verifyToken, async (req, res) => {
  try {
    const { bidId } = req.params;
    const freelancerId = req.user.id;

    const bid = await Bid.findById(bidId);
    if (!bid || decrypt(bid.freelancerId) !== freelancerId) {
      return res.status(404).json({ error: "Bid not found or you are not authorized to delete this bid." });
    }

    const decryptedProjectId = decrypt(bid.projectId);
    const project = await Project.findById(decryptedProjectId);

    // Check project status
    if (project && decrypt(project.status) === "accepted") {
      return res.status(400).json({
        error: "Bid deletion is not allowed as the project is already accepted.",
      });
    }

    // Delete the bid
    await bid.deleteOne();

    // Check if there are any remaining bids for the project
    const allBids = await Bid.find();
    const remainingBids = allBids.filter(b => decrypt(b.projectId) === decryptedProjectId);
    if (remainingBids.length === 0 && project && decrypt(project.status) === "selected") {
      // If no bids are left, update the project status to "pending"
      project.status = eccEncrypt("pending");
      await project.save();
    }

    const projectToLog = await Project.findById(decryptedProjectId);
    
    // Log the activity - Modified: Encrypt userId and messages
    await Activity.create({
      userId: eccEncrypt(freelancerId),
      action: eccEncrypt(`You deleted your bid for project "${decrypt(project.title)}".`),
    });

    // Create a notification for the client
    await Notification.create({
      user: project.client, // Already encrypted
      message: eccEncrypt(`A freelancer has deleted their bid for project "${decrypt(project.title)}".`),
    });

    res.status(200).json({ message: "Bid deleted successfully." });
  } catch (error) {
    console.error("Error deleting bid:", error);
    res.status(500).json({ error: "Failed to delete bid." });
  }
});

module.exports = router;