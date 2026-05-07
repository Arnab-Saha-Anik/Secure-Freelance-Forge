const express = require("express");
const router = express.Router();
const FreelancerInformation = require("../models/freelancerInformationModel");
const User = require("../models/userModel");
const { verifyToken } = require("../middleware/authMiddleware");
const Activity = require("../models/activityModel");
// Modified: Use RSA for FreelancerInformation and ECC for others
const { rsaEncrypt, rsaDecrypt, eccEncrypt, eccDecrypt, decrypt } = require('../utils/cryptoUtils');
const { comparePassword } = require('../utils/hash');

router.get("/:userId", verifyToken, async (req, res) => {
  try {
    const allFreelancerInformation = await FreelancerInformation.find();
    const freelancerInformation = allFreelancerInformation.find(fi => decrypt(fi.userId) === req.params.userId);
    if (!freelancerInformation) {
      return res.status(404).json({ error: "Freelancer profile not found" });
    }
    // Modified: Reverted to RSA for FreelancerInformation fields
    res.json({
      _id: freelancerInformation._id,
      userId: freelancerInformation.userId,
      skills: freelancerInformation.skills.map(s => rsaDecrypt(s ?? "")),
      portfolio: rsaDecrypt(freelancerInformation.portfolio ?? ""),
      experience: rsaDecrypt(freelancerInformation.experience ?? ""),
      // Modified: Decrypt numeric stats
      earnings: rsaDecrypt(freelancerInformation.earnings ?? ""),
      reviews: rsaDecrypt(freelancerInformation.reviews ?? ""),
      projectsCompleted: rsaDecrypt(freelancerInformation.projectsCompleted ?? ""),
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


router.get("/check/:userId", verifyToken, async (req, res) => {
  try {
    const allFreelancerInformation = await FreelancerInformation.find();
    const freelancerInformation = allFreelancerInformation.find(fi => decrypt(fi.userId) === req.params.userId);
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
    const allFreelancerInformation = await FreelancerInformation.find();
    const existingProfile = allFreelancerInformation.find(fi => decrypt(fi.userId) === userId);
    if (existingProfile) {
      return res.status(400).json({ error: "Freelancer profile already exists" });
    }

    // Modified: Use ECC for userId and RSA for other FreelancerInformation fields
    const freelancerInformation = new FreelancerInformation({
      userId: eccEncrypt(userId),
      skills: Array.isArray(skills) ? skills.map(s => rsaEncrypt(s ?? "")) : [rsaEncrypt(skills ?? "")],
      portfolio: rsaEncrypt(portfolio ?? ""),
      experience: rsaEncrypt(experience ?? ""),
      earnings: rsaEncrypt("0"),
      reviews: rsaEncrypt("0"),
      projectsCompleted: rsaEncrypt("0"),
    });

    await freelancerInformation.save();

    // Log the activity
    await Activity.create({
      userId: eccEncrypt(userId),
      action: eccEncrypt("You created your freelancer profile."),
    });

    // Modified: Reverted to RSA for response
    res.status(201).json({
      _id: freelancerInformation._id,
      userId: freelancerInformation.userId,
      skills: freelancerInformation.skills.map(s => rsaDecrypt(s ?? "")),
      portfolio: rsaDecrypt(freelancerInformation.portfolio ?? ""),
      experience: rsaDecrypt(freelancerInformation.experience ?? ""),
      earnings: rsaDecrypt(freelancerInformation.earnings ?? ""),
      reviews: rsaDecrypt(freelancerInformation.reviews ?? ""),
      projectsCompleted: rsaDecrypt(freelancerInformation.projectsCompleted ?? ""),
    });
  } catch (err) {
    console.error("Error creating freelancer profile:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});


router.put("/:userId", verifyToken, async (req, res) => {
  const { skills, portfolio, experience } = req.body;

  try {
    const allFreelancerInformation = await FreelancerInformation.find();
    const freelancerInformation = allFreelancerInformation.find(fi => decrypt(fi.userId) === req.params.userId);

    if (!freelancerInformation) {
      return res.status(404).json({ error: "Freelancer profile not found" });
    }

    freelancerInformation.skills = Array.isArray(skills) ? skills.map(s => rsaEncrypt(s ?? "")) : [rsaEncrypt(skills ?? "")];
    freelancerInformation.portfolio = rsaEncrypt(portfolio ?? "");
    freelancerInformation.experience = rsaEncrypt(experience ?? "");

    await freelancerInformation.save();

    // Log the activity
    await Activity.create({
      userId: eccEncrypt(req.params.userId),
      action: eccEncrypt("You updated your freelancer profile."),
    });

    // Modified: Decrypt fields for the response (guarded with ?? "")
    res.json({
      _id: freelancerInformation._id,
      userId: freelancerInformation.userId,
      skills: freelancerInformation.skills.map(s => rsaDecrypt(s ?? "")),
      portfolio: rsaDecrypt(freelancerInformation.portfolio ?? ""),
      experience: rsaDecrypt(freelancerInformation.experience ?? ""),
      // Modified: Decrypt numeric stats
      earnings: rsaDecrypt(freelancerInformation.earnings ?? ""),
      reviews: rsaDecrypt(freelancerInformation.reviews ?? ""),
      projectsCompleted: rsaDecrypt(freelancerInformation.projectsCompleted ?? ""),
    });
  } catch (err) {
    console.error("Error updating freelancer profile:", err);
    res.status(500).json({ error: "Server error" });
  }
});


router.delete("/delete", verifyToken, async (req, res) => {
  const { email, password } = req.body;

  try {
    // Modified: Encrypt email to find the user in the database
    const user = await User.findOne({ email: rsaEncrypt(email) });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid password" });
    }

    const allFreelancerInformation = await FreelancerInformation.find();
    const freelancerInfo = allFreelancerInformation.find(fi => decrypt(fi.userId) === user._id.toString());
    if (freelancerInfo) {
      await FreelancerInformation.findByIdAndDelete(freelancerInfo._id);
    }
    await User.findByIdAndDelete(user._id);

    res.json({ message: "Account and freelancer profile deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


router.get("/stats/:userId", verifyToken, async (req, res) => {
  try {
    const allFreelancerInformation = await FreelancerInformation.find();
    const freelancerInfo = allFreelancerInformation.find(fi => decrypt(fi.userId) === req.params.userId);
    
    if (!freelancerInfo) {
      return res.status(404).json({ error: "Freelancer profile not found" });
    }
    
    // Modified: Decrypt numeric stats before returning
    res.json({
      earnings: rsaDecrypt(freelancerInfo.earnings ?? ""),
      projectsCompleted: rsaDecrypt(freelancerInfo.projectsCompleted ?? ""),
      reviews: rsaDecrypt(freelancerInfo.reviews ?? ""),
    });
  } catch (err) {
    console.error("Error fetching freelancer stats:", err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;