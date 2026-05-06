const express = require("express");
const Project = require("../models/projectModel");
const User = require("../models/userModel"); 
const Notification = require("../models/notificationModel");
const { verifyToken } = require("../middleware/authMiddleware");
const cron = require("node-cron");
const DirectHire = require("../models/directHireModel");
const Bid = require("../models/bidModel"); // Adjust the path if necessary
const Activity = require("../models/activityModel"); // Import the Activity model
const FreelancerInformation = require("../models/freelancerInformationModel"); // Import the FreelancerInformation model
const router = express.Router();

// Schedule a task to run every day at midnight
cron.schedule("0 0 * * *", async () => {
  try {
    // const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format
    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set time to 00:00:00

    // Find projects with deadlines earlier than today
    const expiredProjects = await Project.find({ deadline: { $lt: today } });

    for (const project of expiredProjects) {
      // Notify the client
      await Notification.create({
        user: project.client,
        message: `The deadline for your project "${project.title}" has passed.`,
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
      title,
      description,
      budget,
      deadline,
      client,
    });

    await project.save();

    // Log the activity
    await Activity.create({
      userId: client,
      action: `You created a project titled "${title}".`,
    });

    res.status(201).json(project);
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
      .populate("client", "email name") // Populate the client field with email and name
      .exec();

    res.status(200).json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ message: "Error fetching projects", error });
  }
});

router.get("/featured", async (req, res) => {
  try {
    // Fetch the latest 6 projects sorted by the MongoDB _id field
    const featuredProjects = await Project.find().sort({ _id: -1 }).limit(6);
    res.status(200).json(featuredProjects);
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

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    res.status(200).json(project);
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
    const projects = await Project.find({ client: clientId });

    res.status(200).json(projects);
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

    
    if (name && name !== user.name) {
      user.name = name;
    }
    
    await user.save();
    await Activity.create({
      userId: client,
      action: `You have updated created your profile.`,
    });

    res.json({ message: "Profile updated successfully", name: user.name });
  } catch (err) {
    console.error("Error in /client/update:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// Update Project
router.put("/client/update/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { budget, deadline } = req.body;

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
    if (project.client.toString() !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to update this project." });
    }

    // Check if the project status is "accepted"
    if (project.status === "accepted") {
      return res.status(400).json({
        error: "This project cannot be updated because its status is 'accepted'.",
      });
    }

    // Check if a direct hire has been placed for the project
    const directHireExists = await DirectHire.findOne({ projectId: id });
    if (directHireExists) {
      return res.status(400).json({
        error: "This project cannot be updated because a direct hire has been placed.",
      });
    }

    // Update the project fields
    if (budget) project.budget = budget;
    if (deadline) project.deadline = deadline;

    await project.save();

    // Log the activity
    await Activity.create({
      userId: req.user.id,
      action: `You updated the project "${project.title}".`,
    });

    res.status(200).json({ message: "Project updated successfully", project });
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

    // Ensure the client is authorized to delete the project
    if (project.client.toString() !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to delete this project" });
    }

    if (project.status !== "pending") {
      return res.status(400).json({
        error: "This project cannot be deleted because its status is not 'pending'.",
      });
    }

    // Check if the escrow is refunded
    if (project.escrowStatus !== "Not Funded") {
      return res.status(400).json({
        error: "Refund your escrow money first to delete the project.",
      });
    }

    // Delete the project
    await Project.findByIdAndDelete(id);

    // Log the activity
    await Activity.create({
      userId: req.user.id,
      action: `You deleted the project "${project.title}".`,
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
    if (project.client.toString() !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to update this project." });
    }

    // Update the project status
    project.status = status;
    await project.save();

    // Log the activity
    await Activity.create({
      userId: req.user.id,
      action: `You updated the status of the project "${project.title}" to "${status}".`,
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
    if (project.acceptedFreelancer.toString() !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to update this project." });
    }

    // Validate the completion percentage
    if (completedpercentage < 0 || completedpercentage > 100) {
      return res.status(400).json({ error: "Completion percentage must be between 0 and 100." });
    }

    // Update the completion percentage
    project.completedpercentage = completedpercentage;
    await project.save();

    // Log the activity
    await Activity.create({
      userId: req.user.id,
      action: `You updated the completion percentage of the project "${project.title}" to ${completedpercentage}%.`,
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

    if (project.acceptedFreelancer.toString() !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to submit this project." });
    }

    project.completionUrl = completionUrl;
    project.approvalStatus = "Pending";
    await project.save();

    res.status(200).json({ message: "Project completion URL submitted successfully.", project });
    // Add activity log
    await Activity.create({
      userId: req.user.id,
      action: `You submitted a completion URL for project "${project.title}".`,
    });
  } catch (error) {
    console.error("Error submitting project completion URL:", error);
    res.status(500).json({ error: "Failed to submit project completion URL." });
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

    if (project.client.toString() !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to approve this project." });
    }

    project.approvalStatus = "Approved";
    await project.save();

    // Update freelancer's completed projects count
    const freelancerInfo = await FreelancerInformation.findOne({ userId: project.acceptedFreelancer });
    if (freelancerInfo) {
      freelancerInfo.projectsCompleted += 1;
      await freelancerInfo.save();
    }

    // Add notification for the freelancer
    await Notification.create({
      user: project.acceptedFreelancer,
      message: `Your work on project "${project.title}" has been approved! You can now claim payment.`,
    });

    // Log activity for client
    await Activity.create({
      userId: req.user.id,
      action: `You approved the completion of project "${project.title}".`,
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
        approvalStatus: "Rejected",
        rejectionComment: comments,
        completedpercentage: completedpercentage || 0,
        completionUrl: null,
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
      userId: client._id,
      action: `You have rejected the project approval of title: "${project.title}".`,
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

    if (project.client.toString() !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to fund this project." });
    }

    if (project.escrowStatus !== "Not Funded") {
      return res.status(400).json({ error: "Escrow has already been funded for this project." });
    }

    // Verify payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "Succeeded") {
      return res.status(400).json({ error: "Payment not completed." });
    }

    // Update escrow status
    project.escrowStatus = "Funded";
    project.paymentIntentId = paymentIntentId;
    await project.save();

    res.status(200).json({ message: "Escrow funded successfully.", project });
    // Add activity log
    await Activity.create({
      userId: req.user.id,
      action: `You funded the escrow for project "${project.title}".`,
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

    if (project.client.toString() !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to release escrow for this project." });
    }

    if (project.escrowStatus === "Not Funded") {
      return res.status(400).json({ error: "Escrow has not been funded or has already been released." });
    }

    // Simulate fund transfer to the freelancer
    // Here, you would integrate with a payment gateway to transfer the funds.

    project.escrowStatus = "released";
    await project.save();

    res.status(200).json({ message: "Escrow released successfully.", project });
    // Add activity log
    await Activity.create({
      userId: req.user.id,
      action: `You released the escrow for project "${project.title}".`,
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

    if (project.client.toString() !== req.user.id) {
      return res.status(403).json({ error: "You are not authorized to refund escrow for this project." });
    }

    if (project.escrowStatus !== "Funded") {
      return res.status(400).json({ error: "Escrow has not been funded or has already been refunded." });
    }

    // Simulate refund to the client
    project.escrowStatus = "Refunded";
    await project.save();
    res.status(200).json({ message: "Escrow refunded successfully.", project });
    // Add activity log
    await Activity.create({
      userId: req.user.id,
      action: `You refunded the escrow for project "${project.title}".`,
    });
  } catch (error) {
    console.error("Error refunding escrow:", error);
    res.status(500).json({ error: "Failed to refund escrow." });
  }
});

module.exports = router;
