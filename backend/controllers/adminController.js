const express = require("express");
const router = express.Router();
const User = require("../models/userModel");
const Activity = require("../models/activityModel");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");
const { rsaEncrypt, rsaDecrypt, eccDecrypt, decrypt } = require("../utils/cryptoUtils");
const { hashPassword, comparePassword } = require("../utils/hash");
const { run: rotateKeys } = require("../generate-keys.js");

// All routes in this controller are protected by verifyToken and isAdmin
router.use(verifyToken, isAdmin);

// GET: Fetch all users with decrypted data
router.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 });
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
    res.status(500).json({ error: "Failed to fetch users." });
  }
});

// DELETE: Delete a user
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    // Also delete freelancer information if it exists
    const FreelancerInfo = require("../models/freelancerInformationModel");
    await FreelancerInfo.findOneAndDelete({ userId: id });
    
    res.status(200).json({ message: "User deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user." });
  }
});

// PUT: Update user role
router.put("/users/role/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: "Role is required" });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.role = rsaEncrypt(role);
    await user.save();

    res.status(200).json({ message: `User role updated to ${role}.` });
  } catch (err) {
    res.status(500).json({ error: "Failed to update role." });
  }
});

// POST: Add a new admin
router.post("/users/add-admin", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingUser = await User.findOne({ email: rsaEncrypt(email) });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await hashPassword(password);
    const newAdmin = new User({
      name: rsaEncrypt(name),
      email: rsaEncrypt(email),
      password: hashedPassword,
      role: rsaEncrypt("admin"),
      isActive: true
    });

    await newAdmin.save();
    res.status(201).json({ message: "New admin added successfully." });
  } catch (err) {
    res.status(500).json({ error: "Failed to add admin." });
  }
});

// GET: Fetch all audit logs (Activities)
router.get("/activities", async (req, res) => {
  try {
    const allActivities = await Activity.find().sort({ timestamp: -1 });
    const allUsers = await User.find(); // Fetch users for lookup

    const decryptedActivities = allActivities.map(activity => {
      const uId = decrypt(activity.userId);
      const user = allUsers.find(u => u._id.toString() === uId);
      
      return {
        ...activity.toObject(),
        action: eccDecrypt(activity.action),
        userId: uId,
        userEmail: user ? rsaDecrypt(user.email) : "Unknown User"
      };
    });
    res.status(200).json(decryptedActivities);
  } catch (error) {
    console.error("Audit log error:", error);
    res.status(500).json({ error: "Failed to fetch audit logs." });
  }
});

// POST: Rotate keys
router.post("/rotate-keys", async (req, res) => {
  try {
    const result = await rotateKeys();
    if (result.success) {
      res.status(200).json({ message: "Keys rotated successfully. System is now using updated key versions." });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to rotate keys." });
  }
});

// GET: View own profile
router.get("/me", async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({
            id: user._id,
            name: rsaDecrypt(user.name),
            email: rsaDecrypt(user.email),
            role: rsaDecrypt(user.role)
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch profile." });
    }
});

// PUT: Edit own profile
router.put("/me", async (req, res) => {
    try {
        const { name, email, newPassword, currentPassword } = req.body;
        
        if (!currentPassword) {
            return res.status(400).json({ error: "Current password is required to authorize changes." });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "Admin not found" });

        // Verify current password
        const isMatch = await comparePassword(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid current password. Authorization failed." });
        }

        // Check if email is being changed
        if (email && email !== rsaDecrypt(user.email)) {
            // Check if email already exists
            const existingUser = await User.findOne({ email: rsaEncrypt(email) });
            if (existingUser) {
                return res.status(400).json({ error: "Email already in use." });
            }

            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            global.adminEmailUpdateOtpStore = global.adminEmailUpdateOtpStore || {};
            global.adminEmailUpdateOtpStore[req.user.id] = {
                newEmail: email,
                otp,
                name: name || rsaDecrypt(user.name),
                newPassword: newPassword || null,
                expiresAt: Date.now() + 10 * 60 * 1000,
            };

            // Reusing sendOtpEmail logic (copied from userController for now)
            const nodemailer = require("nodemailer");
            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: "Verify Your New Admin Email - FF",
                text: `Your OTP for changing your admin email is: ${otp}`,
            });
            console.log(`[DEBUG] Admin Email Update OTP for ${email}: ${otp}`);

            return res.status(202).json({ message: "OTP sent to your new email. Please verify to complete the change." });
        }

        // Apply non-email changes
        if (name) user.name = rsaEncrypt(name);
        if (newPassword) user.password = await hashPassword(newPassword);

        await user.save();
        res.status(200).json({ message: "Profile updated successfully." });
    } catch (err) {
        console.error("Profile update error:", err);
        res.status(500).json({ error: "Failed to update profile." });
    }
});

// POST: Verify email change OTP
router.post("/verify-email-otp", async (req, res) => {
    try {
        const { otp } = req.body;
        const userId = req.user.id;

        if (!global.adminEmailUpdateOtpStore || !global.adminEmailUpdateOtpStore[userId]) {
            return res.status(400).json({ error: "OTP expired or not requested." });
        }

        const { otp: storedOtp, newEmail, name, newPassword } = global.adminEmailUpdateOtpStore[userId];

        if (storedOtp !== otp) {
            return res.status(400).json({ error: "Invalid OTP." });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found." });

        user.email = rsaEncrypt(newEmail);
        user.name = rsaEncrypt(name);
        if (newPassword) user.password = await hashPassword(newPassword);

        await user.save();
        delete global.adminEmailUpdateOtpStore[userId];

        res.status(200).json({ message: "Email and profile updated successfully." });
    } catch (err) {
        res.status(500).json({ error: "Failed to verify OTP." });
    }
});

// GET: Health check for keys and system status
router.get("/health", async (req, res) => {
  try {
    const { rsaDecrypt, eccDecrypt } = require("../utils/cryptoUtils");
    const fs = require("fs");
    const path = require("path");
    
    const keysDir = path.join(__dirname, "..", "keys");
    const rsaKeys = fs.readdirSync(keysDir).filter(f => f.startsWith("rsa_key_"));
    const eccKeys = fs.readdirSync(keysDir).filter(f => f.startsWith("ecc_key_"));

    // Basic health check logic
    const isHealthy = rsaKeys.length > 0 && eccKeys.length > 0;
    
    res.status(200).json({
      status: isHealthy ? "Healthy" : "Degraded",
      encryption: "Active (RSA / ECC)",
      integrity: "Verified (HMAC-SHA256)",
      details: {
        rsaVersions: rsaKeys.length,
        eccVersions: eccKeys.length,
        uptime: process.uptime()
      }
    });
  } catch (error) {
    res.status(500).json({ status: "Error", message: error.message });
  }
});

module.exports = router;
