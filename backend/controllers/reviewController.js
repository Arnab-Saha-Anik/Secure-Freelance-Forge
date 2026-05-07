const express = require("express");
const router = express.Router();
const Review = require("../models/reviewModel");
const Project = require("../models/projectModel");
const User = require("../models/userModel");
const FreelancerInformation = require("../models/freelancerInformationModel");
const Activity = require("../models/activityModel");
const Notification = require("../models/notificationModel");
const { verifyToken } = require("../middleware/authMiddleware");
// Modified: Use RSA for FreelancerInformation and ECC for others (like Review, Project, Activity, Notification)
const { eccEncrypt, eccDecrypt, rsaEncrypt, rsaDecrypt, decrypt } = require('../utils/cryptoUtils');

// Create a new review
router.post("/", verifyToken, async (req, res) => {
  try {
    const { projectId, receiverId, rating, comment } = req.body;
    const reviewerId = req.user.id;
    const decryptedReceiverId = decrypt(receiverId);

    // Check if project exists and is approved
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (decrypt(project.approvalStatus) !== "Approved") {
      return res.status(400).json({ error: "Project must be approved before reviews can be submitted" });
    }

    // Determine reviewer type and validate authorization - Modified: Decrypt client and freelancer IDs for comparison
    let reviewerType;
    const reviewerIdStr = reviewerId.toString();
    const projectClientStr = decrypt(project.client);
    const projectFreelancerStr = decrypt(project.acceptedFreelancer);

    if (projectClientStr === reviewerIdStr) {
      reviewerType = "client";
      if (decryptedReceiverId !== projectFreelancerStr) {
        return res.status(403).json({ 
          error: "You can only review the freelancer assigned to this project"
        });
      }
    } else if (projectFreelancerStr === reviewerIdStr) {
      reviewerType = "freelancer";
      if (decryptedReceiverId !== projectClientStr) {
        return res.status(403).json({ 
          error: "You can only review the client of this project"
        });
      }
    } else {
      return res.status(403).json({ 
        error: "You must be associated with this project to leave a review"
      });
    }

    // Check if review already exists - Modified: Filter by decrypted projectId and reviewerId
    const allReviews = await Review.find();
    const existingReview = allReviews.find(r => decrypt(r.projectId) === projectId && decrypt(r.reviewerId) === reviewerIdStr);

    if (existingReview) {
      return res.status(400).json({ error: "You have already submitted a review for this project" });
    }

    // Modified: Encrypt IDs, rating, and comment
    const review = new Review({
      projectId: eccEncrypt(projectId),
      reviewerId: eccEncrypt(reviewerIdStr),
      receiverId: eccEncrypt(decryptedReceiverId),
      rating: eccEncrypt(rating.toString()),
      comment: eccEncrypt(comment),
      reviewerType: eccEncrypt(reviewerType),
    });

    await review.save();

    // Send notification to the receiver
    const receiver = await User.findById(decryptedReceiverId);
    if (receiver) {
      let message;
      const decryptedTitle = eccDecrypt(project.title);
      if (reviewerType === "client") {
        message = `You received a review from your client for project "${decryptedTitle}".`;
      } else {
        message = `You received a review from your freelancer for project "${decryptedTitle}".`;
      }
      // Modified: Encrypt notification message and userId
      await Notification.create({
        user: eccEncrypt(decryptedReceiverId),
        message: eccEncrypt(message),
        read: eccEncrypt("false"),
      });
    }

    // Update average ratings
    if (reviewerType === "client") {
      // Update freelancer's average rating
      const allFreelancerInfo = await FreelancerInformation.find();
      const freelancerInfo = allFreelancerInfo.find(fi => decrypt(fi.userId) === receiverId.toString());
      
      if (freelancerInfo) {
        const allReviews = await Review.find();
        const receiverReviews = allReviews.filter(r => decrypt(r.receiverId) === decryptedReceiverId && r.reviewerType === "client");
        // Modified: Decrypt ECC ratings for average calculation
        const avgRating = receiverReviews.reduce((sum, r) => sum + parseFloat(decrypt(r.rating)), 0) / receiverReviews.length;
        // Modified: Reverted to RSA for storing average rating in FreelancerInformation
        freelancerInfo.reviews = rsaEncrypt(avgRating.toFixed(1));
        await freelancerInfo.save();
      }
    }

    // Modified: Encrypt activity log and userId
    await Activity.create({
      userId: eccEncrypt(reviewerIdStr),
      action: eccEncrypt(`You submitted a review for project "${decrypt(project.title)}".`),
    });

    res.status(201).json({ 
      message: "Review submitted successfully", 
      review: {
        ...review.toObject(),
        rating: eccDecrypt(review.rating),
        comment: eccDecrypt(review.comment),
      } 
    });
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

// Get reviews for a specific user (as received reviews)
router.get("/received/:userId", verifyToken, async (req, res) => {
  try {
    const userId = decrypt(req.params.userId);
    const allReviews = await Review.find();
    const filteredReviews = allReviews.filter(r => decrypt(r.receiverId) === userId);
    
    // Modified: Decrypt reviews and manually fetch reviewer info since refs are broken
    const decryptedReviews = await Promise.all(filteredReviews.map(async (r) => {
      let decryptedReviewerId = decrypt(r.reviewerId);
      if (decryptedReviewerId && typeof decryptedReviewerId === 'string' && decryptedReviewerId.startsWith('ecc_')) {
        decryptedReviewerId = decrypt(decryptedReviewerId);
      }
      const reviewer = await User.findById(decryptedReviewerId).select("name email");
      
      return {
        ...r.toObject(),
        rating: decrypt(r.rating),
        comment: decrypt(r.comment),
        reviewerType: decrypt(r.reviewerType),
        reviewerId: reviewer ? {
          ...reviewer.toObject(),
          name: rsaDecrypt(reviewer.name),
          email: rsaDecrypt(reviewer.email),
        } : null,
        projectId: await (async () => {
          let decProjectId = decrypt(r.projectId);
          if (decProjectId && typeof decProjectId === 'string' && decProjectId.startsWith('ecc_')) {
            decProjectId = decrypt(decProjectId);
          }
          const project = await Project.findById(decProjectId).select("title");
          return project ? {
            ...project.toObject(),
            title: decrypt(project.title),
          } : null;
        })(),
      };
    }));

    res.status(200).json(decryptedReviews);
  } catch (error) {
    console.error("Error fetching received reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Get reviews submitted by a user
router.get("/submitted/:userId", verifyToken, async (req, res) => {
  try {
    const userId = decrypt(req.params.userId);
    const allReviews = await Review.find().sort({ createdAt: -1 });
    const filteredReviews = allReviews.filter(r => decrypt(r.reviewerId) === userId);
    
    // Modified: Decrypt reviews, manually fetch receivers, and decrypt project titles
    const decryptedReviews = await Promise.all(filteredReviews.map(async (r) => {
      let decryptedReceiverId = decrypt(r.receiverId);
      if (decryptedReceiverId && typeof decryptedReceiverId === 'string' && decryptedReceiverId.startsWith('ecc_')) {
        decryptedReceiverId = decrypt(decryptedReceiverId);
      }
      const receiver = await User.findById(decryptedReceiverId).select("name email");
      
      let decProjectId = decrypt(r.projectId);
      if (decProjectId && typeof decProjectId === 'string' && decProjectId.startsWith('ecc_')) {
        decProjectId = decrypt(decProjectId);
      }
      const project = await Project.findById(decProjectId).select("title");
      
      return {
        ...r.toObject(),
        rating: decrypt(r.rating),
        comment: decrypt(r.comment),
        reviewerType: decrypt(r.reviewerType),
        receiverId: receiver ? {
          ...receiver.toObject(),
          name: rsaDecrypt(receiver.name),
          email: rsaDecrypt(receiver.email),
        } : null,
        projectId: project ? {
          ...project.toObject(),
          title: decrypt(project.title),
        } : null,
      };
    }));

    res.status(200).json(decryptedReviews);
  } catch (error) {
    console.error("Error fetching submitted reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Get reviews for a specific project
router.get("/project/:projectId", verifyToken, async (req, res) => {
  try {
    const allReviews = await Review.find().sort({ createdAt: -1 });
    const projectReviews = allReviews.filter(r => decrypt(r.projectId) === req.params.projectId);
    
    // Modified: Decrypt reviews, manually fetch reviewers, and receivers
    const decryptedReviews = await Promise.all(projectReviews.map(async (r) => {
      let decryptedReviewerId = decrypt(r.reviewerId);
      if (decryptedReviewerId && typeof decryptedReviewerId === 'string' && decryptedReviewerId.startsWith('ecc_')) {
        decryptedReviewerId = decrypt(decryptedReviewerId);
      }

      let decryptedReceiverId = decrypt(r.receiverId);
      if (decryptedReceiverId && typeof decryptedReceiverId === 'string' && decryptedReceiverId.startsWith('ecc_')) {
        decryptedReceiverId = decrypt(decryptedReceiverId);
      }
      
      const reviewer = await User.findById(decryptedReviewerId).select("name email");
      const receiver = await User.findById(decryptedReceiverId).select("name email");
      
      return {
        ...r.toObject(),
        rating: decrypt(r.rating),
        comment: decrypt(r.comment),
        reviewerType: decrypt(r.reviewerType),
        reviewerId: reviewer ? {
          ...reviewer.toObject(),
          name: rsaDecrypt(reviewer.name),
          email: rsaDecrypt(reviewer.email),
        } : null,
        receiverId: receiver ? {
          ...receiver.toObject(),
          name: rsaDecrypt(receiver.name),
          email: rsaDecrypt(receiver.email),
        } : null,
        projectId: await (async () => {
          let decProjectId = decrypt(r.projectId);
          if (decProjectId && typeof decProjectId === 'string' && decProjectId.startsWith('ecc_')) {
            decProjectId = decrypt(decProjectId);
          }
          const project = await Project.findById(decProjectId).select("title");
          return project ? {
            ...project.toObject(),
            title: decrypt(project.title),
          } : null;
        })(),
      };
    }));

    res.status(200).json(decryptedReviews);
  } catch (error) {
    console.error("Error fetching project reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Check if user has already reviewed for a project
router.get("/check/:projectId", verifyToken, async (req, res) => {
  try {
    const allReviews = await Review.find();
    const projectReviews = allReviews.filter(r => decrypt(r.projectId) === req.params.projectId);
    const review = projectReviews.find(r => decrypt(r.reviewerId) === req.user.id);
    
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
    
    const totalReviews = await Review.find();
    const reviews = totalReviews.filter(r => decrypt(r.receiverId) === userId);
    
    if (reviews.length === 0) {
      return res.json({ averageRating: null });
    }
    
    // Modified: Decrypt ratings before calculating total
    const totalRating = reviews.reduce((sum, review) => sum + parseFloat(decrypt(review.rating)), 0);
    const averageRating = totalRating / reviews.length;
    
    res.json({ averageRating: averageRating.toFixed(1) });
  } catch (error) {
    console.error("Error fetching average rating:", error);
    res.status(500).json({ error: "Failed to fetch average rating" });
  }
});

module.exports = router;