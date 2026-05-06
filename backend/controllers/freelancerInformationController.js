const express = require("express");
const router = express.Router();
const FreelancerInformation = require("../models/freelancerInformationModel");
const User = require("../models/userModel");
const { verifyToken } = require("../middleware/authMiddleware"); 
const Activity = require("../models/activityModel"); // Import the Activity model

router.get("/:userId", verifyToken, async (req, res) => {
  try {
    const freelancerInformation = await FreelancerInformation.findOne({ userId: req.params.userId });
    if (!freelancerInformation) {
      return res.status(404).json({ error: "Freelancer profile not found" });
    }
    res.json(freelancerInformation);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


router.get("/check/:userId", verifyToken, async (req, res) => {
  try {
    const freelancerInformation = await FreelancerInformation.findOne({ userId: req.params.userId });
    if (freelancerInformation) {
      return res.json({ exists: true });
    }
    res.json({ exists: false });
  } catch (err) {
    console.error("Error checking freelancer profile existence:", err);
    res.status(500).json({ error: "Server error" });
  }
});


router.post("/", verifyToken, async (req, res) => {
  const { userId, skills, portfolio, experience } = req.body;

  try {

 
    const existingProfile = await FreelancerInformation.findOne({ userId });
    if (existingProfile) {
      return res.status(400).json({ error: "Freelancer profile already exists" });
    }


    const freelancerInformation = new FreelancerInformation({
      userId,
      skills,
      portfolio,
      experience,
      earnings: 0,
      reviews: 0,
      projectsCompleted: 0,
    });

    await freelancerInformation.save();

    // Log the activity
    await Activity.create({
      userId,
      action: "You created your freelancer profile.",
    });

    res.status(201).json(freelancerInformation);
  } catch (err) {
    console.error("Error creating freelancer profile:", err); // Log the error
    res.status(500).json({ error: err.message || "Server error" });
  }
});


router.put("/:userId", verifyToken, async (req, res) => {
  const { skills, portfolio, experience } = req.body;

  try {
    const freelancerInformation = await FreelancerInformation.findOneAndUpdate(
      { userId: req.params.userId },
      { skills, portfolio, experience },
      { new: true }
    );

    if (!freelancerInformation) {
      return res.status(404).json({ error: "Freelancer profile not found" });
    }

    // Log the activity
    await Activity.create({
      userId: req.params.userId,
      action: "You updated your freelancer profile.",
    });

    res.json(freelancerInformation);
  } catch (err) {
    console.error("Error updating freelancer profile:", err);
    res.status(500).json({ error: "Server error" });
  }
});


router.delete("/delete", verifyToken, async (req, res) => {
  const { email, password } = req.body;

  try {

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }


    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid password" });
    }


    await FreelancerInformation.findOneAndDelete({ userId: user._id });


    await User.findByIdAndDelete(user._id);

    res.json({ message: "Account and freelancer profile deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


router.get("/stats/:userId", verifyToken, async (req, res) => {
  try {
    const freelancerInfo = await FreelancerInformation.findOne({ userId: req.params.userId });
    
    if (!freelancerInfo) {
      return res.status(404).json({ error: "Freelancer profile not found" });
    }
    
    // Return just the stats needed for the dashboard
    res.json({
      earnings: freelancerInfo.earnings,
      projectsCompleted: freelancerInfo.projectsCompleted,
      reviews: freelancerInfo.reviews
    });
  } catch (err) {
    console.error("Error fetching freelancer stats:", err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;