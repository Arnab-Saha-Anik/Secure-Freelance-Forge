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
// Modified: Import the RSA utility functions
const { rsaEncrypt, rsaDecrypt } = require('../utils/cryptoUtils');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const createTransporter = () => nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOtpEmail = async (email, otp) => {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Verify Your Email - OTP",
    text: `Your OTP is: ${otp}`,
  });
};

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Modified: Encrypt email before checking for existence in the database
    const existingUser = await User.findOne({ email: rsaEncrypt(email) });
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
    // Step 1: Validate the primary credentials before issuing an OTP.
      const user = await User.findOne({ email: rsaEncrypt(email) });
      if (!user) {
          return res.status(400).json({ error: 'Invalid email or password' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
          return res.status(400).json({ error: 'Invalid email or password' });
      }

      // Modified: Decrypt the role from the database for comparison
      const decryptedRole = rsaDecrypt(user.role);
      if (decryptedRole.toLowerCase() !== role.toLowerCase()) {
          return res.status(403).json({ error: 'Selected role does not match your account role' });
      }

      const otp = generateOTP();

      global.loginOtpStore = global.loginOtpStore || {};
      global.loginOtpStore[email] = {
        otp,
        userId: user._id.toString(),
        name: user.name,
        role: user.role,
        email: user.email,
        expiresAt: Date.now() + 10 * 60 * 1000,
      };

      await sendOtpEmail(email, otp);

      res.status(200).json({
        message: 'OTP sent to your email. Please verify to complete login.',
        email,
      });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
}); 

router.post('/verify-login-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    if (!global.loginOtpStore || !global.loginOtpStore[email]) {
      return res.status(400).json({ error: 'OTP expired or invalid. Please login again.' });
    }

    const pendingLogin = global.loginOtpStore[email];

    if (pendingLogin.expiresAt < Date.now()) {
      delete global.loginOtpStore[email];
      return res.status(400).json({ error: 'OTP expired or invalid. Please login again.' });
    }

    if (pendingLogin.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const user = await User.findById(pendingLogin.userId);
    if (!user) {
      delete global.loginOtpStore[email];
      return res.status(404).json({ error: 'User not found' });
    }

    const decryptedName = rsaDecrypt(user.name);
    const decryptedRole = rsaDecrypt(user.role);
    const token = jwt.sign(
      { id: user._id, name: decryptedName, role: decryptedRole },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    delete global.loginOtpStore[email];

    res.status(200).json({
      message: 'Login successful',
      token,
      role: decryptedRole,
      name: decryptedName,
    });
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
    
    // Modified: Encrypt the name if it's being updated
    if (name && name !== rsaDecrypt(user.name)) {
      user.name = rsaEncrypt(name);
    }
    
    await user.save();

    await Activity.create({
      userId: req.user.id,
      action: "You updated your user information.",
    });

    // Modified: Decrypt the name for the response
    res.json({ message: "Profile updated successfully", name: rsaDecrypt(user.name) });
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

    // Modified: Encrypt the name if it's being updated
    if (name && name !== rsaDecrypt(user.name)) {
      user.name = rsaEncrypt(name);
    }

    await user.save();

    await Activity.create({
      userId: req.user.id,
      action: "You updated your account information.",
    });

    // Modified: Decrypt the name for the response
    res.status(200).json({ message: "Profile updated successfully", name: rsaDecrypt(user.name) });
  } catch (err) {
    console.error("Error updating account information:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/delete", verifyToken, async (req, res) => {
  const { email, password } = req.body;

  try {
    // Modified: Encrypt email to find the user
    const user = await User.findOne({ email: rsaEncrypt(email) });
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

    // Modified: Decrypt the stored email for comparison
    if (rsaDecrypt(user.email) !== email) {
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

    // Modified: Decrypt data before sending to the frontend
    res.json({
      id: user._id,
      name: rsaDecrypt(user.name),
      email: rsaDecrypt(user.email),
      role: rsaDecrypt(user.role),
    });
  } catch (err) {
    console.error("Error fetching user data:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/validate", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Modified: Encrypt email to find the user
    const user = await User.findOne({ email: rsaEncrypt(email) });
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
    // Modified: Decrypt user data for display
    const decryptedUsers = users.map(user => ({
        _id: user._id,
        name: rsaDecrypt(user.name),
        email: rsaDecrypt(user.email),
        role: rsaDecrypt(user.role),
        isActive: user.isActive
    }));
    res.status(200).json(decryptedUsers);
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
    const freelancers = await User.aggregate([
      {
        $lookup: {
          from: "freelancerinformations",
          localField: "_id",
          foreignField: "userId",
          as: "profile",
        },
      },
      {
        // Modified: Match against the encrypted role
        $match: {
          role: rsaEncrypt("Freelancer"),
          "profile.0": { $exists: true },
        },
      },
    ]);

    // Modified: Decrypt the results before sending to the client
    const decryptedFreelancers = freelancers.map(f => ({
        ...f,
        name: rsaDecrypt(f.name),
        email: rsaDecrypt(f.email),
        role: rsaDecrypt(f.role)
    }));

    res.status(200).json(decryptedFreelancers);
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

    // New Change: Salt is generated and included automatically by bcrypt.hash
    const hashedPassword = await bcrypt.hash(password, 10);

    // Modified: Encrypt data before saving to the database
    const user = new User({
      name: rsaEncrypt(name),
      email: rsaEncrypt(email),
      password: hashedPassword,
      role: rsaEncrypt(role),
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
    // Modified: Encrypt email before checking for existence
    const user = await User.findOne({ email: rsaEncrypt(email) });
    if (user) {
      return res.status(200).json({ exists: true });
    }
    res.status(200).json({ exists: false });
  } catch (err) {
    console.error("Error checking email existence:", err);
    res.status(500).json({ message: "Server error" });
  }
});

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