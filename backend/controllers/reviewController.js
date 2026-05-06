const express = require("express");
const router = express.Router();
const Review = require("../models/reviewModel");
const Project = require("../models/projectModel");
const User = require("../models/userModel");
const FreelancerInformation = require("../models/freelancerInformationModel");
const Activity = require("../models/activityModel");
const Notification = require("../models/notificationModel");
const { verifyToken } = require("../middleware/authMiddleware");

// Create a new review
router.post("/", verifyToken, async (req, res) => {
  try {
    const { projectId, receiverId, rating, comment } = req.body;
    const reviewerId = req.user.id;

    // Check if project exists and is approved
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.approvalStatus !== "Approved") {
      return res.status(400).json({ error: "Project must be approved before reviews can be submitted" });
    }

    // Determine reviewer type and validate authorization
    let reviewerType;

    // Convert IDs to strings for consistent comparison
    const reviewerIdStr = reviewerId.toString();
    const projectClientStr = project.client.toString();
    const projectFreelancerStr = project.acceptedFreelancer.toString();
    const receiverIdStr = receiverId.toString();

    if (projectClientStr === reviewerIdStr) {
      // Client is reviewing freelancer
      reviewerType = "client";
      if (projectFreelancerStr !== receiverIdStr) {
        return res.status(403).json({ 
          error: "You can only review the freelancer assigned to this project"
        });
      }
    } else if (projectFreelancerStr === reviewerIdStr) {
      // Freelancer is reviewing client
      reviewerType = "freelancer";
      if (projectClientStr !== receiverIdStr) {
        return res.status(403).json({ 
          error: "You can only review the client of this project"
        });
      }
    } else {
      return res.status(403).json({ 
        error: "You must be associated with this project to leave a review"
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      projectId,
      reviewerId,
    });

    if (existingReview) {
      return res.status(400).json({ error: "You have already submitted a review for this project" });
    }

    // Create the review
    const review = new Review({
      projectId,
      reviewerId,
      receiverId,
      rating,
      comment,
      reviewerType,
    });

    await review.save();

    // Send notification to the receiver
    const receiver = await User.findById(receiverId);
    if (receiver) {
      let message;
      if (reviewerType === "client") {
        message = `You received a review from your client for project "${project.title}".`;
      } else {
        message = `You received a review from your freelancer for project "${project.title}".`;
      }
      await Notification.create({
        user: receiverId,
        message,
      });
    }

    // Update average ratings
    if (reviewerType === "client") {
      // Update freelancer's average rating
      const freelancerInfo = await FreelancerInformation.findOne({ userId: receiverId });
      if (freelancerInfo) {
        const allFreelancerReviews = await Review.find({
          receiverId,
          reviewerType: "client",
        });
        
        const totalRating = allFreelancerReviews.reduce((sum, review) => sum + review.rating, 0);
        const avgRating = totalRating / allFreelancerReviews.length;
        
        freelancerInfo.reviews = parseFloat(avgRating.toFixed(1));
        await freelancerInfo.save();
      }
    }

    // Log activity
    await Activity.create({
      userId: reviewerId,
      action: `You submitted a review for ${reviewerType === "client" ? "freelancer" : "client"} on project "${project.title}"`,
    });

    res.status(201).json(review);
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

// Get reviews for a specific user (as received reviews)
router.get("/received/:userId", verifyToken, async (req, res) => {
  try {
    const reviews = await Review.find({ receiverId: req.params.userId })
      .populate("reviewerId", "name email")
      .populate("projectId", "title")
      .sort({ createdAt: -1 });
    
    res.status(200).json(reviews);
  } catch (error) {
    console.error("Error fetching received reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Get reviews submitted by a user
router.get("/submitted/:userId", verifyToken, async (req, res) => {
  try {
    const reviews = await Review.find({ reviewerId: req.params.userId })
      .populate("receiverId", "name email")
      .populate("projectId", "title")
      .sort({ createdAt: -1 });
    
    res.status(200).json(reviews);
  } catch (error) {
    console.error("Error fetching submitted reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Get reviews for a specific project
router.get("/project/:projectId", verifyToken, async (req, res) => {
  try {
    const reviews = await Review.find({ projectId: req.params.projectId })
      .populate("reviewerId", "name email")
      .populate("receiverId", "name email")
      .sort({ createdAt: -1 });
    
    res.status(200).json(reviews);
  } catch (error) {
    console.error("Error fetching project reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Check if user has already reviewed for a project
router.get("/check/:projectId", verifyToken, async (req, res) => {
  try {
    const review = await Review.findOne({
      projectId: req.params.projectId,
      reviewerId: req.user.id,
    });
    
    res.status(200).json({ hasReviewed: !!review });
  } catch (error) {
    console.error("Error checking review:", error);
    res.status(500).json({ error: "Failed to check review status" });
  }
});

// Get average rating for a specific user
router.get("/average/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const reviews = await Review.find({ receiverId: userId });
    
    if (reviews.length === 0) {
      return res.json({ averageRating: null });
    }
    
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;
    
    res.json({ averageRating });
  } catch (error) {
    console.error("Error fetching average rating:", error);
    res.status(500).json({ error: "Failed to fetch average rating" });
  }
});

module.exports = router;