const express = require("express");
const Project = require("../models/projectModel");
const User = require("../models/userModel"); 
const Notification = require("../models/notificationModel");
const { verifyToken } = require("../middleware/authMiddleware");
const cron = require("node-cron");
const DirectHire = require("../models/directHireModel");
const Bid = require("../models/bidModel");
const Activity = require("../models/activityModel");
const FreelancerInformation = require("../models/freelancerInformationModel");
const router = express.Router();
// Modified: Use RSA for User and ECC for Project. Import unified decrypt.
const { eccEncrypt, eccDecrypt, rsaEncrypt, rsaDecrypt, decrypt } = require('../utils/cryptoUtils');

// Schedule a task to run every day at midnight
cron.schedule("0 0 * * *", async () => {
  try {
    // const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format
    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set time to 00:00:00

    // Find projects with deadlines earlier than today
    const allProjects = await Project.find();
    const expiredProjects = allProjects.filter(project => {
        const deadline = decrypt(project.deadline);
        return deadline && new Date(deadline) < today;
    });

    for (const project of expiredProjects) {
      // Notify the client
      await Notification.create({
        user: project.client, // Already encrypted in DB
        message: eccEncrypt(`The deadline for your project "${decrypt(project.title)}" has passed.`),
        read: eccEncrypt("false"),
      });

    }

    console.log(`Notified clients about ${expiredProjects.length} expired projects.`);
  } catch (error) {
    console.error("Error notifying clients about expired projects:", error);
  }
});

router.post("/create", verifyToken, async (req, res) => {
  const { title, description, budget, deadline, client } = req.body;

  if (!client) {
    return res.status(400).json({ error: "Client ID is required" });
  }

  const today = new Date().toISOString().split("T")[0];
  if (deadline < today) {
    return res.status(400).json({ error: "The deadline cannot be a date in the past." });
  }

  try {
    const project = new Project({
      title: eccEncrypt(title),
      description: eccEncrypt(description),
      budget: eccEncrypt(budget.toString()),
      deadline: eccEncrypt(deadline),
      client: eccEncrypt(client), // Modified: Encrypt client ID with ECC
      status: eccEncrypt("pending"),
      completedpercentage: eccEncrypt("0"),
      escrowStatus: eccEncrypt("Not Funded"),
      approvalStatus: eccEncrypt("Pending"),
      claimStatus: eccEncrypt("Pending"),
    });

    await project.save();

    // Modified: Encrypt activity log and userId
    await Activity.create({
      userId: eccEncrypt(client),
      action: eccEncrypt(`You created a project titled "${title}".`),
    });

    // Modified: Decrypt all project fields for response using unified decrypt
    res.status(201).json({
      ...project.toObject(),
      title: decrypt(project.title),
      description: decrypt(project.description),
      budget: decrypt(project.budget),
      deadline: decrypt(project.deadline),
      status: decrypt(project.status),
      completedpercentage: decrypt(project.completedpercentage),
      escrowStatus: decrypt(project.escrowStatus),
      approvalStatus: decrypt(project.approvalStatus),
      claimStatus: decrypt(project.claimStatus),
    });
  } catch (error) {if (error.code === 11000) {
      return res.status(400).json({
        error: `A project with the title "${title}" already exists for this client.`,
      });
    }

    console.error("Error creating project:", error);
    res.status(500).json({ error: "Server error" });
  }
});


router.get("/", async (req, res) => {
  try {
    // Fetch all projects and populate the client field to include the email
    const projects = await Project.find()
      .populate("client", "email name")
      .exec();

    // Modified: Decrypt all project fields and manually fetch client info
    const decryptedProjects = await Promise.all(projects.map(async (p) => {
      const decryptedClientId = decrypt(p.client);
      const clientUser = await User.findById(decryptedClientId).select("name email");
      
      return {
        ...p.toObject(),
        title: decrypt(p.title || ""),
        description: decrypt(p.description || ""),
        budget: decrypt(p.budget || ""),
        deadline: decrypt(p.deadline || ""),
        acceptedmoney: decrypt(p.acceptedmoney || ""),
        status: decrypt(p.status || "pending"),
        acceptedFreelancer: decrypt(p.acceptedFreelancer || ""),
        completedpercentage: Number(decrypt(p.completedpercentage || "0")),
        escrowStatus: decrypt(p.escrowStatus || "Not Funded"),
        completionUrl: decrypt(p.completionUrl || ""),
        approvalStatus: decrypt(p.approvalStatus || "Pending"),
        rejectionComment: decrypt(p.rejectionComment || ""),
        claimStatus: decrypt(p.claimStatus || "Pending"),
        client: clientUser ? {
          ...clientUser.toObject(),
          name: rsaDecrypt(clientUser.name),
          email: rsaDecrypt(clientUser.email),
        } : null,
      };
    }));

    res.status(200).json(decryptedProjects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ message: "Error fetching projects", error });
  }
});

router.get("/featured", async (req, res) => {
  try {
    // Fetch the latest 6 projects sorted by the MongoDB _id field
    const featuredProjects = await Project.find().sort({ _id: -1 }).limit(6);
    
    // Modified: Decrypt featured projects using unified decrypt
    const decryptedFeatured = featuredProjects.map(p => ({
      ...p.toObject(),
      title: decrypt(p.title),
      description: decrypt(p.description),
      budget: decrypt(p.budget),
      deadline: decrypt(p.deadline),
      status: decrypt(p.status),
      acceptedFreelancer: decrypt(p.acceptedFreelancer),
    }));

    res.status(200).json(decryptedFeatured);
  } catch (error) {
    console.error("Error fetching featured projects:", error);
    res.status(500).json({ message: "Error fetching featured projects", error });
  }
});

router.get("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid project ID." });
  }

  try {
    const project = await Project.findById(id).populate("client", "name email");

    // Modified: Decrypt all project and manually fetch client info
    const decryptedClientId = decrypt(project.client);
    const clientUser = await User.findById(decryptedClientId).select("name email");

    const decryptedProject = {
      ...project.toObject(),
      title: decrypt(project.title),
      description: decrypt(project.description),
      budget: decrypt(project.budget),
      deadline: decrypt(project.deadline),
      acceptedmoney: decrypt(project.acceptedmoney),
      status: decrypt(project.status),
      acceptedFreelancer: decrypt(project.acceptedFreelancer),
      completedpercentage: decrypt(project.completedpercentage),
      escrowStatus: decrypt(project.escrowStatus),
      completionUrl: decrypt(project.completionUrl),
      approvalStatus: decrypt(project.approvalStatus),
      rejectionComment: decrypt(project.rejectionComment),
      claimStatus: decrypt(project.claimStatus),
      client: clientUser ? {
        ...clientUser.toObject(),
        name: rsaDecrypt(clientUser.name),
        email: rsaDecrypt(clientUser.email),
      } : null,
    };

    res.status(200).json(decryptedProject);
  } catch (error) {
    console.error("Error fetching project details:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    
    if (!id || id.length !== 24) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    
    const project = await Project.findByIdAndDelete(id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({ message: "Project deleted successfully" });
  } catch (err) {
    console.error("Error deleting project:", err); // Log the actual error
    res.status(500).json({ message: "Error deleting project", error: err.message });
  }
});


router.delete("/admin/:id", async (req, res) => {
  try {
    const { id } = req.params;

    
    if (!id || id.length !== 24) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    
    const project = await Project.findByIdAndDelete(id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({ message: "Project deleted successfully" });
  } catch (err) {
    console.error("Error deleting project:", err);
    res.status(500).json({ message: "Error deleting project", error: err.message });
  }
});


router.get("/client/projects", verifyToken, async (req, res) => {
  try {
    const clientId = req.user.id; 
    const allProjects = await Project.find();
    const projects = allProjects.filter(p => decrypt(p.client) === clientId);

    // Modified: Decrypt projects for client dashboard
    const decryptedProjects = projects.map(p => ({
      ...p.toObject(),
      title: decrypt(p.title || ""),
      description: decrypt(p.description || ""),
      budget: decrypt(p.budget || ""),
      deadline: decrypt(p.deadline || ""),
      acceptedmoney: decrypt(p.acceptedmoney || ""),
      status: decrypt(p.status || "pending"),
      completedpercentage: Number(decrypt(p.completedpercentage || "0")),
      escrowStatus: decrypt(p.escrowStatus || "Not Funded"),
      paymentIntentId: decrypt(p.paymentIntentId || ""),
      approvalStatus: decrypt(p.approvalStatus || "Pending"),
      completionUrl: decrypt(p.completionUrl || ""),
    }));

    res.status(200).json(decryptedProjects);
  } catch (error) {
    console.error("Error fetching client projects:", error);
    res.status(500).json({ message: "Error fetching projects", error });
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

    
    // Modified: Reverted to RSA for User name update
    if (name && name !== rsaDecrypt(user.name)) {
      user.name = rsaEncrypt(name);
    }
    
    await user.save();
    // Modified: Use req.user.id and encrypt action with ECC
    await Activity.create({
      userId: req.user.id,
      action: eccEncrypt("You updated your profile information."),
    });

    res.json({ message: "Profile updated successfully", name: rsaDecrypt(user.name) });
  } catch (err) {
    console.error("Error in /client/update:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// Update Project
router.put("/client/update/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { title, description, budget, deadline } = req.body;

  // Validate that the deadline is not in the past
  const today = new Date().toISOString().split("T")[0];
  if (deadline && deadline < today) {
    return res.status(400).json({ error: "The deadline cannot be a date in the past." });
  }

  try {
    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    // Ensure the client is authorized to update the project
    if (decrypt(project.client) !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to update this project." });
    }

    // Check if the project status is "accepted" - Modified: Decrypt status for comparison
    if (decrypt(project.status) === "accepted") {
      return res.status(400).json({
        error: "This project cannot be updated because its status is 'accepted'.",
      });
    }

    // Check if a direct hire has been placed for the project - Modified: Manual filter for encrypted projectId
    const allDirectHires = await DirectHire.find();
    const directHireExists = allDirectHires.find(dh => decrypt(dh.projectId) === id);
    if (directHireExists) {
      return res.status(400).json({
        error: "This project cannot be updated because a direct hire has been placed.",
      });
    }

    // Update the project fields - Modified: Encrypt title, description, budget, and deadline using ECC
    if (title) project.title = eccEncrypt(title);
    if (description) project.description = eccEncrypt(description);
    if (budget) project.budget = eccEncrypt(budget.toString());
    if (deadline) project.deadline = eccEncrypt(deadline);

    await project.save();

    // Log the activity - Modified: Decrypt title for log message, Encrypt userId
    const decryptedTitle = decrypt(project.title);
    await Activity.create({
      userId: eccEncrypt(req.user.id),
      action: eccEncrypt(`You updated the project "${decryptedTitle}".`),
    });

    res.status(200).json({ 
      message: "Project updated successfully", 
      project: {
        ...project.toObject(),
        title: decrypt(project.title),
        description: decrypt(project.description),
        budget: decrypt(project.budget),
        deadline: decrypt(project.deadline),
      }
    });
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Server error" });
  }
});


// Delete Project
router.delete("/client/delete/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate project ID
    if (!id || id.length !== 24) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    // Find the project
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Ensure the client is authorized to delete the project - Modified: Decrypt client for comparison
    if (decrypt(project.client) !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to delete this project" });
    }

    // Modified: Decrypt status for comparison
    if (decrypt(project.status) !== "pending") {
      return res.status(400).json({
        error: "This project cannot be deleted because its status is not 'pending'.",
      });
    }

    // Check if the escrow is refunded - Modified: Decrypt escrowStatus for comparison
    if (decrypt(project.escrowStatus) !== "Not Funded") {
      return res.status(400).json({
        error: "Refund your escrow money first to delete the project.",
      });
    }

    // Delete the project
    await Project.findByIdAndDelete(id);

    // Modified: Decrypt title for log and encrypt entire action and userId
    const decryptedTitle = decrypt(project.title);
    await Activity.create({
      userId: eccEncrypt(req.user.id),
      action: eccEncrypt(`You deleted the project "${decryptedTitle}".`),
    });

    res.status(200).json({ message: "Project deleted successfully." });
  } catch (err) {
    console.error("Error deleting project:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Update Project Status
router.put("/status/:projectId", verifyToken, async (req, res) => {
  const { projectId } = req.params;
  const { status } = req.body;

  const validStatuses = ["pending", "selected", "accepted", "done"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid project status." });
  }

  try {
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    // Ensure the client is authorized to update the project
    if (decrypt(project.client) !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to update this project." });
    }

    // Update the project status - Modified: Encrypt status with ECC
    project.status = eccEncrypt(status);
    await project.save();

    // Modified: Decrypt title for log and encrypt entire action and userId
    const decryptedTitle = decrypt(project.title);
    await Activity.create({
      userId: eccEncrypt(req.user.id),
      action: eccEncrypt(`You updated the status of the project "${decryptedTitle}" to "${status}".`),
    });

    res.status(200).json({ message: "Project status updated successfully.", project });
  } catch (error) {
    console.error("Error updating project status:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Route to update project completion percentage
router.put("/update-completion/:projectId", verifyToken, async (req, res) => {
  const { projectId } = req.params;
  const { completedpercentage } = req.body;

  try {
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    // Ensure the freelancer updating the percentage is the accepted freelancer
    if (decrypt(project.acceptedFreelancer) !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to update this project." });
    }

    // Validate the completion percentage
    if (completedpercentage < 0 || completedpercentage > 100) {
      return res.status(400).json({ error: "Completion percentage must be between 0 and 100." });
    }

    // Update the completion percentage - Modified: Encrypt with ECC
    project.completedpercentage = eccEncrypt(completedpercentage.toString());
    await project.save();

    // Modified: Decrypt title for log and encrypt entire action and userId
    const decryptedTitle = decrypt(project.title);
    await Activity.create({
      userId: eccEncrypt(req.user.id),
      action: eccEncrypt(`You updated the completion percentage of the project "${decryptedTitle}" to ${completedpercentage}%.`),
    });

    res.status(200).json({ message: "Project completion percentage updated successfully.", project });
  } catch (error) {
    console.error("Error updating project completion percentage:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Route to submit project completion URL
router.put("/submit-completion/:projectId", verifyToken, async (req, res) => {
  const { projectId } = req.params;
  const { completionUrl } = req.body;

  try {
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    if (decrypt(project.acceptedFreelancer) !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to submit this project." });
    }

    project.completionUrl = eccEncrypt(completionUrl);
    project.approvalStatus = eccEncrypt("Pending");
    await project.save();

    res.status(200).json({ message: "Project completion URL submitted successfully.", project });
    // Modified: Decrypt title for log and encrypt activity action and userId
    const decryptedTitle = decrypt(project.title);
    await Activity.create({
      userId: eccEncrypt(req.user.id),
      action: eccEncrypt(`You submitted a completion URL for project "${decryptedTitle}".`),
    });
  } catch (error) {
    console.error("Error submitting project completion URL:", error);
    res.status(500).json({ error: "Failed to submit project completion URL." });
  }
});

// Route to delete project completion URL
router.delete("/delete-completion/:projectId", verifyToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    if (decrypt(project.acceptedFreelancer) !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to modify this project." });
    }

    project.completionUrl = eccEncrypt("");
    // If deleted, we might want to reset approval status back to Pending if it wasn't already
    project.approvalStatus = eccEncrypt("Pending");
    await project.save();

    res.status(200).json({ message: "Project completion URL deleted successfully.", project });
    
    const decryptedTitle = decrypt(project.title);
    await Activity.create({
      userId: eccEncrypt(req.user.id),
      action: eccEncrypt(`You deleted the completion URL for project "${decryptedTitle}".`),
    });
  } catch (error) {
    console.error("Error deleting project completion URL:", error);
    res.status(500).json({ error: "Failed to delete project completion URL." });
  }
});

// Route to approve project completion
router.put("/approve-completion/:projectId", verifyToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    if (decrypt(project.client) !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to approve this project." });
    }

    project.approvalStatus = eccEncrypt("Approved");
    await project.save();

    // Update freelancer's completed projects count
    const freelancerId = decrypt(project.acceptedFreelancer);
    const allFreelancerInfo = await FreelancerInformation.find();
    const targetedFreelancerInfo = allFreelancerInfo.find(fi => decrypt(fi.userId) === freelancerId);

    if (targetedFreelancerInfo) {
      // Modified: Reverted to RSA for incrementing projectsCompleted
      const current = parseInt(rsaDecrypt(targetedFreelancerInfo.projectsCompleted ?? "")) || 0;
      targetedFreelancerInfo.projectsCompleted = rsaEncrypt(String(current + 1));
      await targetedFreelancerInfo.save();
    }

    // Modified: Decrypt title for notification and log
    const decryptedTitle = eccDecrypt(project.title);

    // Add notification for the freelancer
    await Notification.create({
      user: project.acceptedFreelancer, // Already encrypted
      message: eccEncrypt(`Your work on project "${decryptedTitle}" has been approved! You can now claim payment.`),
      read: eccEncrypt("false"),
    });

    // Log activity for client
    await Activity.create({
      userId: eccEncrypt(req.user.id),
      action: eccEncrypt(`You approved the work for project "${decryptedTitle}".`),
    });

    res.status(200).json({ message: "Project approved successfully.", project });
  } catch (error) {
    console.error("Error approving project:", error);
    res.status(500).json({ error: "Failed to approve project." });
  }
});

// Route to reject project approval
router.put("/reject-approval/:projectId", async (req, res) => {
  const { projectId } = req.params;
  const { comments, completedpercentage, completionUrl } = req.body;

  try {
    const project = await Project.findByIdAndUpdate(
      projectId,
      {
        approvalStatus: eccEncrypt("Rejected"),
        rejectionComment: eccEncrypt(comments || ""),
        completedpercentage: eccEncrypt((completedpercentage || 0).toString()),
        completionUrl: eccEncrypt(""),
      },
      { new: true }
    );

    if (!project) {
      console.error("Project not found:", projectId);
      return res.status(404).json({ message: "Project not found" });
    }

    // Make sure client is defined
    const client = project.client;

    await Activity.create({
      userId: project.client, // Already encrypted
      action: eccEncrypt(`You have rejected the project approval of title: "${decrypt(project.title)}".`),
    });
    return res.status(200).json({ message: "Project approval rejected" });
  } catch (error) {
    console.error("Error rejecting approval:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to fund escrow for a project
router.put("/escrow/fund/:projectId", verifyToken, async (req, res) => {
  const { projectId } = req.params;
  const { paymentIntentId } = req.body;

  try {
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    if (decrypt(project.client) !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to fund this project." });
    }

    // Modified: Decrypt escrowStatus for comparison
    if (decrypt(project.escrowStatus) !== "Not Funded") {
      return res.status(400).json({ error: "Escrow has already been funded for this project." });
    }

    // Verify payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "Succeeded") {
      return res.status(400).json({ error: "Payment not completed." });
    }

    // Update escrow status - Modified: Encrypt with ECC
    project.escrowStatus = eccEncrypt("Funded");
    project.status = eccEncrypt("selected");
    project.paymentIntentId = eccEncrypt(paymentIntentId);
    await project.save();

    res.status(200).json({ message: "Escrow funded successfully.", project });
    // Add activity log
    await Activity.create({
      userId: eccEncrypt(req.user.id),
      action: eccEncrypt(`You funded the escrow for project "${decrypt(project.title)}".`),
    });
  } catch (error) {
    console.error("Error funding escrow:", error);
    res.status(500).json({ error: "Failed to fund escrow." });
  }
});

// Route to release escrow for a project
router.post("/escrow/release/:projectId", verifyToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    if (decrypt(project.client) !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to release escrow for this project." });
    }

    // Modified: Decrypt escrowStatus for comparison
    if (decrypt(project.escrowStatus) === "Not Funded") {
      return res.status(400).json({ error: "Escrow has not been funded or has already been released." });
    }

    // Simulate fund transfer to the freelancer
    // Here, you would integrate with a payment gateway to transfer the funds.

    project.escrowStatus = eccEncrypt("released");
    await project.save();

    res.status(200).json({ message: "Escrow released successfully.", project });
    // Modified: Decrypt title for log and encrypt entire action
    const decryptedTitle = decrypt(project.title);
    await Activity.create({
      userId: project.client, // Already encrypted
      action: eccEncrypt(`You released the escrow for project "${decryptedTitle}".`),
    });
  } catch (error) {
    console.error("Error releasing escrow:", error);
    res.status(500).json({ error: "Failed to release escrow." });
  }
});

// Route to refund escrow for a project
router.post("/escrow/refund/:projectId", verifyToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    if (decrypt(project.client) !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to refund escrow for this project." });
    }

    // Modified: Decrypt escrowStatus for comparison
    if (decrypt(project.escrowStatus) !== "Funded") {
      return res.status(400).json({ error: "Escrow has not been funded or has already been refunded." });
    }

    // Simulate refund to the client - Modified: Encrypt with ECC
    project.escrowStatus = eccEncrypt("Refunded");
    await project.save();
    res.status(200).json({ message: "Escrow refunded successfully.", project });
    // Add activity log
    await Activity.create({
      userId: eccEncrypt(req.user.id),
      action: eccEncrypt(`You refunded the escrow for project "${decrypt(project.title)}".`),
    });
  } catch (error) {
    console.error("Error refunding escrow:", error);
    res.status(500).json({ error: "Failed to refund escrow." });
  }
});

module.exports = router;
