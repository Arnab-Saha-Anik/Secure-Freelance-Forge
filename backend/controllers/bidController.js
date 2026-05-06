const express = require("express");
const router = express.Router();
const Bid = require("../models/bidModel");
const Notification = require("../models/notificationModel"); // Import the Notification model
const { verifyToken } = require("../middleware/authMiddleware");
const Project = require("../models/projectModel");
const User = require("../models/userModel");
const Activity = require("../models/activityModel"); // Import the Activity model
const DirectHire = require("../models/directHireModel"); // Import the DirectHire model
const Review = require("../models/reviewModel"); // Import the Review model
const FreelancerInformation = require("../models/freelancerInformationModel"); // Import the FreelancerInformation model

// Route to fetch accepted bids
router.get("/accepted", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id; // Assuming `verifyToken` adds `user` to `req`
    const bids = await Bid.find({ freelancerId: userId, status: "accepted" }).populate("projectId", "title client");
    res.status(200).json(bids);
  } catch (error) {
    console.error("Error fetching accepted bids:", error);
    res.status(500).json({ error: "Failed to fetch accepted bids" });
  }
});

// Route to fetch selected bids for the freelancer
router.get("/selected", verifyToken, async (req, res) => {
  try {
    const freelancerId = req.user.id; // Assuming `verifyToken` adds `user` to `req`

    // Fetch bids for the freelancer and populate associated projects
    const selectedBids = await Bid.find({ freelancerId })
      .populate({
        path: "projectId",
        match: { status: "selected" }, // Match projects with status "selected"
        select: "title description budget deadline client", // Explicitly select required fields
        populate: {
          path: "client", // Populate the client field
          select: "name email", // Select only the name and email fields
        },
      });

    // Filter out bids where the project does not match the "selected" status
    const filteredBids = selectedBids.filter((bid) => bid.projectId !== null);

    if (filteredBids.length === 0) {
      return res.status(404).json({ error: "No selected bids available." });
    }

    // Format the response to include project and client details
    const formattedBids = filteredBids.map((bid) => ({
      bidId: bid._id,
      bidAmount: bid.amount,
      project: {
        title: bid.projectId.title,
        description: bid.projectId.description,
        budget: bid.projectId.budget,
        deadline: bid.projectId.deadline,
      },
      client: {
        name: bid.projectId.client?.name || "N/A",
        email: bid.projectId.client?.email || "N/A",
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
    const bids = await Bid.find({ projectId: req.params.projectId })
      .populate({
        path: "freelancerId",
        select: "name email",
      });

    // For each bid, add avgRating and freelancer profile info
    const enhancedBids = await Promise.all(
      bids.map(async (bid) => {
        // Calculate average rating
        let avgRating = 0;
        const reviews = await Review.find({ receiverId: bid.freelancerId._id });
        if (reviews.length > 0) {
          avgRating =
            reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        }

        // Fetch freelancer information
        const freelancerInfo = await FreelancerInformation.findOne({ userId: bid.freelancerId._id });

        return {
          ...bid.toObject(),
          freelancerId: {
            ...bid.freelancerId.toObject(),
            avgRating: avgRating ? avgRating.toFixed(1) : "0",
            profile: freelancerInfo
              ? [{
                  skills: freelancerInfo.skills || [],
                  portfolio: freelancerInfo.portfolio || "",
                  experience: freelancerInfo.experience || "",
                }]
              : [],
          },
        };
      })
    );

    res.status(200).json(enhancedBids);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bids" });
  }
});

// Route to fetch a freelancer's bid for a specific project
router.get("/:projectId/my-bid", verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const freelancerId = req.user.id; // Assuming `verifyToken` adds `user` to `req`

    const bid = await Bid.findOne({ projectId, freelancerId });
    if (!bid) {
      return res.status(404).json({ error: "No bid found for this project." });
    }

    res.status(200).json(bid);
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

    const project = await Project.findById(projectId).populate("client", "email");
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check project status
    if (project.status === "accepted") {
      return res.status(400).json({
        error: "Bidding is not allowed as the project is already accepted.",
      });
    }

    // Check if the freelancer has already submitted a bid for this project
    const existingBid = await Bid.findOne({ projectId, freelancerId });
    if (existingBid) {
      return res.status(400).json({ error: "You have already submitted a bid for this project." });
    }

    // Create a new bid
    const newBid = await Bid.create({
      projectId,
      freelancerId,
      amount: bidAmount,
    });

    const freelancer = await User.findById(req.user.id).select("email");

    // Log the activity
    await Activity.create({
      userId: freelancerId,
      action: `You placed a bid of $${bidAmount} on project "${project.title}".`,
    });

    // Create a notification for the client
    await Notification.create({
      user: project.client._id,
      message: `Freelancer (${freelancer.email}) has posted a bid for project "${project.title}".`,
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

    const bid = await Bid.findById(bidId).populate("freelancerId", "email").populate("projectId", "title client");

    if (!bid) {
      return res.status(404).json({ error: "Bid not found" });
    }

    // Fetch the project document
    const project = await Project.findById(bid.projectId._id);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if escrow is funded
    if (project.escrowStatus === "Not Funded") {
      return res.status(400).json({ error: "Escrow must be funded before selecting a bid." });
    }

    // Update the project status to "selected"
    project.status = "selected";
    await project.save();

    // Notify the freelancer
    await Notification.create({
      user: bid.freelancerId._id,
      message: `Your bid of $${bid.amount} for the project "${project.title}" has been selected.`,
    });

    // Log the activity for the client
    await Activity.create({
      userId: project.client,
      action: `You selected the bid of $${bid.amount} for the project "${project.title}" to the freelancer (${bid.freelancerId.email}).`,
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

    const bid = await Bid.findById(bidId).populate("projectId freelancerId");

    if (!bid) {
      return res.status(404).json({ error: "Bid not found." });
    }

    const projectId = bid.projectId._id;

    // Update the project status to "accepted" and store the accepted freelancer and bid amount
    await Project.findByIdAndUpdate(projectId, {
      status: "accepted",
      acceptedFreelancer: bid.freelancerId._id,
      acceptedmoney: bid.amount,
    });

    // Delete all other bids for the project
    await Bid.deleteMany({ projectId });

    // Delete all direct hires for the project
    await DirectHire.deleteMany({ projectId });

    // Log the activity
    await Activity.create({
      userId: bid.freelancerId._id,
      action: `You accepted the project "${bid.projectId.title}" for $${bid.amount}.`,
    });

    // Notify the client
    await Notification.create({
      user: bid.projectId.client,
      message: `${bid.freelancerId.email} has accepted the project "${bid.projectId.title}" for $${bid.amount}.`,
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

    const bid = await Bid.findById(bidId).populate("projectId");

    if (!bid) {
      return res.status(404).json({ error: "Bid not found." });
    }

    // Ensure the project status is not "accepted"
    if (bid.projectId.status === "accepted") {
      return res.status(400).json({ error: "The bid has already been accepted and cannot be rejected." });
    }

    const projectId = bid.projectId._id;

    // Delete the bid
    await bid.deleteOne();

    // Check if there are any remaining bids for the project
    const remainingBids = await Bid.find({ projectId });
    if (remainingBids.length === 0 && bid.projectId.status === "selected") {
      // If no bids are left, update the project status to "pending"
      await Project.findByIdAndUpdate(projectId, { status: "pending" });
    }

    // Notify the client
    await Notification.create({
      user: bid.projectId.client,
      message: `The selected bid for your project "${bid.projectId.title}" has been rejected by the freelancer.`,
    });

    // Log the activity for the client
    await Activity.create({
      userId: bid.freelancerId._id,
      action: `You have rejected the bid for the project "${bid.projectId.title}".`,
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

    const bid = await Bid.findOne({ _id: bidId, freelancerId }).populate("projectId");
    if (!bid) {
      return res.status(404).json({ error: "Bid not found or you are not authorized to update this bid." });
    }

    // Check project status
    if (bid.projectId.status === "accepted") {
      return res.status(400).json({
        error: "Bid update is not allowed as the project is already accepted.",
      });
    }

    // If the project status is "selected", check if this bid is the selected one
    if (bid.projectId.status === "selected") {
      const selectedBid = await Bid.findOne({ projectId: bid.projectId._id, _id: bidId });
      if (selectedBid && selectedBid._id.toString() === bidId) {
        return res.status(400).json({
          error: "Bid update is not allowed as your bid has already been selected.",
        });
      }
    }

    // Update the bid
    bid.amount = bidAmount;
    await bid.save();

    const project = await Project.findById(bid.projectId).populate("client", "email");
    const freelancer = await User.findById(req.user.id).select("email");

    // Log the activity
    await Activity.create({
      userId: freelancerId,
      action: `You updated your bid to $${bidAmount} for project "${project.title}".`,
    });

    // Create a notification for the client
    await Notification.create({
      user: project.client._id,
      message: `Freelancer (${freelancer.email}) has updated their bid for project "${project.title}".`,
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

    const bid = await Bid.findOne({ _id: bidId, freelancerId }).populate("projectId");

    if (!bid) {
      return res.status(404).json({ error: "Bid not found or you are not authorized to delete this bid." });
    }

    // Check project status
    if (bid.projectId.status === "accepted") {
      return res.status(400).json({
        error: "Bid deletion is not allowed as the project is already accepted.",
      });
    }

    const projectId = bid.projectId._id;

    // Delete the bid
    await bid.deleteOne();

    // Check if there are any remaining bids for the project
    const remainingBids = await Bid.find({ projectId });
    if (remainingBids.length === 0 && bid.projectId.status === "selected") {
      // If no bids are left, update the project status to "pending"
      await Project.findByIdAndUpdate(projectId, { status: "pending" });
    }

    const project = await Project.findById(projectId).populate("client", "email");
    const freelancer = await User.findById(freelancerId).select("email");
    // Log the activity
    await Activity.create({
      userId: freelancerId,
      action: `You deleted your bid for project "${project.title}".`,
    });

    // Create a notification for the client
    await Notification.create({
      user: project.client._id,
      message: `Freelancer (${freelancer.email}) has deleted their bid for project "${project.title}".`,
    });

    res.status(200).json({ message: "Bid deleted successfully." });
  } catch (error) {
    console.error("Error deleting bid:", error);
    res.status(500).json({ error: "Failed to delete bid." });
  }
});

module.exports = router;