const express = require("express");
const stripe = require("../config/stripe");
const Payment = require("../models/paymentModel");
const Project = require("../models/projectModel");
const User = require("../models/userModel"); // Assuming you have a User model
const Activity = require("../models/activityModel"); // Assuming you have an Activity model
const FreelancerInformation = require("../models/freelancerInformationModel"); // Assuming you have a FreelancerInformation model
const { verifyToken } = require("../middleware/authMiddleware"); // Middleware to verify user token

const router = express.Router();

router.post("/create-payment-intent", verifyToken, async (req, res) => {
  const { projectId, amount } = req.body;

  try {
    // Fetch the project from the database
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Fetch the client (user) from the database
    const client = await User.findById(req.user.id);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Create a Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Payment for Project Name: ${project.title}`,
            },
            unit_amount: amount * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/client-dashboard`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      metadata: {
        projectId,
        clientId: client._id.toString(),
        amount: amount.toString(),
        action: "create-payment-intent",
      },
    });
    
    if (!session || !session.id) {
      throw new Error("Failed to create Stripe session. Session or session ID is undefined.");
    }

    // Return session ID for client-side payment processing
    res.status(200).json({ sessionId: session.id });
    // Add activity log
    await Activity.create({
      userId: client._id,
      action: `You initiated a payment of $${amount} for project "${project.title}".`,
    });
  } catch (error) {
    console.error("Error creating Stripe session:", error);
    res.status(500).json({ error: error.message || "Failed to create Stripe session." });
  }
});

// Webhook endpoint
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const projectId = session.metadata.projectId;
      const action = session.metadata.action;
      const amount = parseFloat(session.metadata.amount || "0");

      // Find the project
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).send("Project not found.");
      }

      // Handle different actions
      switch (action) {
        case "create-payment-intent":
          {
            const clientId = session.metadata.clientId;
            const client = await User.findById(clientId);
            
            if (!client) {
              return res.status(404).send("Client not found.");
            }
            
            // Save payment intent to project
            project.paymentIntentId = session.id;
            project.escrowStatus = "Funded";
            await project.save();
            
            // Create a new payment entry
            const payment = new Payment({
              project: project._id,
              client: client._id,
              amount,
              status: "Succeeded",
              paymentIntentId: session.id,
            });
            await payment.save();
            
            // Log activity
            await Activity.create({
              userId: client._id,
              action: `Payment of $${amount} for project title: ${project.title} has been funded in the Escrow System.`,
            });
          }
          break;

        case "claim-money":
          {
            const freelancerId = session.metadata.freelancerId;
            
            // Update payment
            const payment = await Payment.findOneAndUpdate(
              { project: project._id },
              {
                client: project.client,
                freelancer: project.acceptedFreelancer,
                amount: project.acceptedmoney,
                status: "Freelancer Paid",
                paymentIntentId: project.paymentIntentId,
              },
              { new: true, upsert: true }
            );
            
            // Update project
            project.escrowStatus = "Released";
            await project.save();
            
            // Update freelancer earnings
            const freelancerInfo = await FreelancerInformation.findOne({ userId: project.acceptedFreelancer });
            if (freelancerInfo) {
              freelancerInfo.earnings += project.acceptedmoney;
              await freelancerInfo.save();
            }
            
            // Log activity
            await Activity.create({
              userId: project.acceptedFreelancer,
              action: `You have claimed $${project.acceptedmoney} for project "${project.title}".`,
            });
          }
          break;

        case "claim-remaining":
          {
            const clientId = session.metadata.clientId;
            
            // Update project
            project.claimStatus = "Claimed";
            await project.save();
            
            // Log activity
            await Activity.create({
              userId: project.client,
              action: `Remaining budget claimed for project "${project.title}".`,
            });
          }
          break;

        case "refund-escrow":
          {
            const clientId = session.metadata.clientId;
            
            // Update payment status
            const payment = await Payment.findOneAndUpdate(
              { project: project._id },
              { status: "Failed" },
              { new: true }
            );
            
            // Update project
            project.escrowStatus = "Not Funded";
            await project.save();
            
            // Log activity
            await Activity.create({
              userId: project.client,
              action: `Escrow refunded for project "${project.title}".`,
            });
          }
          break;

        default:
          return res.status(400).send(`Unhandled action: ${action}`);
      }

      return res.status(200).send("Webhook handled successfully");
    }

    res.status(400).send("Unhandled event type");
  } catch (error) {
    console.error("❌ Webhook Error:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

router.post("/claim-money/:projectId", verifyToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await Project.findById(projectId).populate("client");

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    // Check for paymentIntentId
    if (!project.paymentIntentId) {
      return res.status(400).json({ error: "Payment intent not found for this project." });
    }

    if (project.approvalStatus !== "Approved") {
      return res.status(400).json({ error: "Project is not accepted for claiming money." });
    }

    if (project.escrowStatus === "Not Funded") {
      return res.status(400).json({ error: "Escrow is not funded for this project." });
    }

    // Validate acceptedmoney
    if (!project.acceptedmoney || isNaN(project.acceptedmoney)) {
      return res.status(400).json({ error: "Invalid accepted money amount." });
    }

    // Generate a Stripe Checkout session for the freelancer to claim money
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Claim Money for Project: ${project.title}`,
            },
            unit_amount: Math.round(project.acceptedmoney * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/freelancer-dashboard`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      metadata: {
        projectId: project._id.toString(),
        paymentIntentId: project.paymentIntentId,
        freelancerId: project.acceptedFreelancer.toString(),
        action: "claim-money",
        amount: project.acceptedmoney.toString(),
      },
    });

    res.status(200).json({ url: session.url });
    // Add activity log
    await Activity.create({
      userId: project.acceptedFreelancer,
      action: `You initiated a claim for $${project.acceptedmoney} on project "${project.title}".`,
    });
  } catch (error) {
    console.error("Error claiming money:", error);
    res.status(500).json({ error: "Failed to claim money." });
  }
});

router.post("/claim-remaining/:projectId", verifyToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    // Check for paymentIntentId
    if (!project.paymentIntentId) {
      return res.status(400).json({ error: "Payment intent not found for this project." });
    }

    if (project.status !== "accepted") {
      return res.status(400).json({ error: "Project is not approved for claiming the remaining budget." });
    }

    const remainingBudget = project.budget - project.acceptedmoney;

    if (remainingBudget <= 0) {
      return res.status(400).json({ error: "No remaining budget to claim." });
    }

    // Create a Stripe Checkout session for the remaining budget
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Claim Remaining Budget for Project: ${project.title}`,
            },
            unit_amount: Math.round(remainingBudget * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/client-dashboard`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      metadata: {
        projectId: project._id.toString(),
        paymentIntentId: project.paymentIntentId,
        clientId: project.client.toString(),
        action: "claim-remaining",
        amount: remainingBudget.toString(),
      },
    });

    res.status(200).json({ url: session.url });
    // Add activity log
    await Activity.create({
      userId: project.client,
      action: `You initiated a claim for the remaining budget ($${remainingBudget}) on project "${project.title}".`,
    });
  } catch (error) {
    console.error("Error claiming remaining budget:", error);
    res.status(500).json({ error: "Failed to claim the remaining budget." });
  }
});

router.post("/refund-escrow/:projectId", verifyToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    // Find the project
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    // Check for paymentIntentId
    if (!project.paymentIntentId) {
      return res.status(400).json({ error: "Payment intent not found for this project." });
    }

    if (project.escrowStatus !== "Funded") {
      return res.status(400).json({ error: "Escrow is not funded for this project." });
    }

    // Create a Stripe Checkout session for the refund
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Refund Escrow for Project: ${project.title}`,
            },
            unit_amount: Math.round(project.budget * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/client-dashboard?refundSuccess=true`,
      cancel_url: `${process.env.CLIENT_URL}/refundCancelled`,
      metadata: {
        projectId: project._id.toString(),
        paymentIntentId: project.paymentIntentId,
        clientId: project.client.toString(),
        action: "refund-escrow",
        amount: project.budget.toString(),
      },
    });
    
    res.status(200).json({ url: session.url });
    // Add activity log
    await Activity.create({
      userId: project.client,
      action: `You initiated an escrow refund for project "${project.title}".`,
    });
  } catch (error) {
    console.error("Error processing refund escrow:", error);
    res.status(500).json({ error: "Failed to process refund escrow." });
  }
});

router.get("/", verifyToken, async (req, res) => {
  try {
    const payments = await Payment.find({ client: req.user.id }).populate("project");
    res.status(200).json(payments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Failed to fetch payments." });
  }
});

module.exports = router;