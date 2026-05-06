const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const { verifyToken } = require("../middleware/authMiddleware");
const freelancerInformation = require('../models/freelancerInformationModel');
const Activity = require('../models/activityModel');
const Notification = require('../models/notificationModel');
const Project = require('../models/projectModel'); 
const nodemailer = require("nodemailer"); 


const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();


router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    
    global.tempOtpStore = global.tempOtpStore || {};
    global.tempOtpStore[email] = { otp, name, email, password, role };

    
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, 
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verify Your Email - OTP",
      text: `Your OTP for email verification is: ${otp}`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "OTP sent to your email. Please verify to complete registration." });
  } catch (error) {
    console.error("Error in registerUser:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post('/login', async (req, res) => {
  const { email, password, role } = req.body; 
  if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password, and role are required' });
  }
  try {
      
      const user = await User.findOne({ email });
      if (!user) {
          return res.status(400).json({ error: 'Invalid email or password' });
      }

      
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
          return res.status(400).json({ error: 'Invalid email or password' });
      }

      
      if (user.role.toLowerCase() !== role.toLowerCase()) {
          return res.status(403).json({ error: 'Selected role does not match your account role' });
      }

      
      const token = jwt.sign({ id: user._id, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

      res.status(200).json({ message: 'Login successful', token, role: user.role });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
}); 


router.put("/update", verifyToken, async (req, res) => {
  const { name, currentPassword, newPassword, confirmPassword } = req.body;

  try {
        const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

        if (!name && !currentPassword && !newPassword && !confirmPassword) {
      return res.status(400).json({ error: "No changes detected" });
    }

        if (currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      
      if (newPassword && (await bcrypt.compare(newPassword, user.password))) {
        return res.status(400).json({ error: "New password cannot be the same as the current password" });
      }

      
      if (newPassword && newPassword !== confirmPassword) {
        return res.status(400).json({ error: "New password and confirm password do not match" });
      }
      
      if (newPassword) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
      }
    }
    
    if (name && name !== user.name) {
      user.name = name;
    }
    
    await user.save();

    // Log the activity
    await Activity.create({
      userId: req.user.id,
      action: "You updated your user information.",
    });

    res.json({ message: "Profile updated successfully", name: user.name });
  } catch (err) {
    console.error("Error updating user information:", err);
    res.status(500).json({ error: "Server error" });
  }
});


router.put("/client/update", verifyToken, async (req, res) => {
  const { name, currentPassword, newPassword, confirmPassword } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!name && !currentPassword && !newPassword && !confirmPassword) {
      return res.status(400).json({ error: "No changes detected" });
    }

    if (currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      
      if (newPassword && (await bcrypt.compare(newPassword, user.password))) {
        return res.status(400).json({ error: "New password cannot be the same as the current password" });
      }


      if (newPassword && newPassword !== confirmPassword) {
        return res.status(400).json({ error: "New password and confirm password do not match" });
      }

      if (newPassword) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
      }
    }

    if (name && name !== user.name) {
      user.name = name;
    }

    await user.save();

    // Log the activity
    await Activity.create({
      userId: req.user.id,
      action: "You updated your account information.",
    });

    res.status(200).json({ message: "Profile updated successfully", name: user.name });
  } catch (err) {
    console.error("Error updating account information:", err);
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

    
    await freelancerInformation.findOneAndDelete({ userId: user._id });

    
    await User.findByIdAndDelete(user._id);

    res.json({ message: "Account and freelancer profile deleted successfully" });
  } catch (err) {
    console.error("Error deleting account:", err);
    res.status(500).json({ error: "Server error" });
  }
});


router.delete("/client/delete", verifyToken, async (req, res) => {
  const { email, currentPassword } = req.body;

  try {
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    
    if (user.email !== email) {
      return res.status(400).json({ error: "The email you provided is not associated with your account." });
    }

    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid password" });
    }

    
    await Project.deleteMany({ client: user._id });

    
    await User.findByIdAndDelete(user._id);

    res.status(200).json({ message: "Account and associated projects deleted successfully" });
  } catch (err) {
    console.error("Error deleting account:", err);
    res.status(500).json({ error: "Server error" });
  }
});


router.delete("/admin/:id", async (req, res) => {
  try {
    const { id } = req.params;

    
    if (!id || id.length !== 24) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    
    await freelancerInformation.findOneAndDelete({ userId: id });

    res.status(200).json({ message: "User and associated freelancer profile deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ message: "Error deleting user", error: err.message });
  }
});


router.get("/me", verifyToken, async (req, res) => {
  try {
    
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    console.error("Error fetching user data:", err);
    res.status(500).json({ error: "Server error" });
  }
});


router.post("/validate", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    res.status(200).json({ message: "Credentials are valid." });
  } catch (err) {
    console.error("Error validating user:", err);
    res.status(500).json({ error: "Server error." });
  }
});


router.get("/", async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }); 
    res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Error fetching users", error: err.message });
  }
});


router.get("/check/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ exists: false });
    }

    res.status(200).json({ exists: true });
  } catch (err) {
    console.error("Error checking user existence:", err);
    res.status(500).json({ error: "Server error" });
  }
});


router.get("/allfreelancers", async (req, res) => {
  try {
    // Use aggregation to join the User and FreelancerInformation collections
    const freelancers = await User.aggregate([
      {
        $lookup: {
          from: "freelancerinformations", // The name of the FreelancerInformation collection
          localField: "_id", // The field in the User collection
          foreignField: "userId", // The field in the FreelancerInformation collection
          as: "profile", // The name of the joined field
        },
      },
      {
        $match: {
          role: "Freelancer", // Only include users with the "Freelancer" role
          "profile.0": { $exists: true }, // Only include users with a profile
        },
      },
      {
        $project: {
          name: 1,
          email: 1,
          "profile.skills": 1,
          "profile.portfolio": 1,
          "profile.experience": 1,
        },
      },
    ]);

    res.status(200).json(freelancers);
  } catch (error) {
    console.error("Error fetching freelancers with profiles:", error);
    res.status(500).json({ message: "Error fetching freelancers with profiles", error });
  }
});


router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    
    if (!global.tempOtpStore || !global.tempOtpStore[email]) {
      return res.status(400).json({ error: "OTP expired or invalid. Please register again." });
    }

    const { otp: storedOtp, name, password, role } = global.tempOtpStore[email];

    
    if (storedOtp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    
    const hashedPassword = await bcrypt.hash(password, 10);

    
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      isActive: true, 
    });

    await user.save();

    
    delete global.tempOtpStore[email];

    res.status(200).json({ message: "Account verified successfully. You can now log in." });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ error: "Server error" });
  }
});


router.post("/check-email", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (user) {
      return res.status(200).json({ exists: true });
    }
    res.status(200).json({ exists: false });
  } catch (err) {
    console.error("Error checking email existence:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Fetch unread notifications count for the logged-in user
router.get("/unread-count", verifyToken, async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ user: req.user.id, read: false });
    res.status(200).json({ unreadCount });
  } catch (error) {
    console.error("Error fetching unread notifications count:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;


