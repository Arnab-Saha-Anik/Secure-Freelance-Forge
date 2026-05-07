const express = require("express");
const stripe = require("../config/stripe");
const Payment = require("../models/paymentModel");
const Project = require("../models/projectModel");
const User = require("../models/userModel");
const Activity = require("../models/activityModel");
const FreelancerInformation = require("../models/freelancerInformationModel");
const { verifyToken } = require("../middleware/authMiddleware");
// Modified: Use unified decrypt helper to handle mixed RSA/ECC data
const { eccEncrypt, eccDecrypt, rsaEncrypt, rsaDecrypt, decrypt } = require('../utils/cryptoUtils');

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
              // Modified: Decrypt project title for display
              name: `Payment for Project Name: ${eccDecrypt(project.title)}`,
            },
            unit_amount: amount * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/client-dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      metadata: {
        projectId: projectId.toString(),
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
    // Modified: Encrypt userId with ECC
    await Activity.create({
      userId: eccEncrypt(client._id.toString()),
      action: eccEncrypt(`You initiated a payment of $${amount} for project "${eccDecrypt(project.title)}".`),
    });
  } catch (error) {
    console.error("Error creating Stripe session:", error);
    res.status(500).json({ error: error.message || "Failed to create Stripe session." });
  }
});

// Webhook endpoint
router.post("/webhook", async (req, res) => {
  console.log("🔔 Stripe Webhook received!");
  const sig = req.headers["stripe-signature"];

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      console.log("✅ Checkout session completed:", session.id);

      const projectId = session.metadata.projectId;
      const action = session.metadata.action;
      const amount = parseFloat(session.metadata.amount || "0");
      const clientId = session.metadata.clientId;

      console.log(`📦 Webhook Metadata - ProjectId: ${projectId}, Action: ${action}, Amount: ${amount}, ClientId: ${clientId}`);

      // Find the project
      const project = await Project.findById(projectId);
      if (!project) {
        console.error(`❌ Project not found: ${projectId}`);
        return res.status(404).send("Project not found.");
      }

      // Handle different actions
      switch (action) {
        case "create-payment-intent":
          {
            const client = await User.findById(clientId);
            if (!client) {
              console.error(`❌ Client not found: ${clientId}`);
              return res.status(404).send("Client not found.");
            }
            
            try {
              // Save payment intent to project - Modified: Encrypt paymentIntentId
              project.paymentIntentId = eccEncrypt(session.id);
              project.escrowStatus = eccEncrypt("Funded");
              project.status = eccEncrypt("selected");
              await project.save();
              console.log(`📈 Project ${projectId} updated: Funded & selected`);
              
              // Create Payment record - Modified: Encrypt paymentIntentId
              const payment = new Payment({
                project: eccEncrypt(projectId),
                client: eccEncrypt(clientId),
                amount: eccEncrypt(amount.toString()),
                status: "Succeeded",
                paymentIntentId: eccEncrypt(session.id),
              });
              await payment.save();
              console.log(`💰 Payment record saved for project ${projectId}`);
              
              // Activity log
              await Activity.create({
                userId: eccEncrypt(clientId),
                action: eccEncrypt(`Payment of $${amount} for project title: ${eccDecrypt(project.title)} has been funded in the Escrow System.`),
              });
              console.log(`📝 Activity log created for client ${clientId}`);
            } catch (saveError) {
              console.error("❌ Database Save Error in Webhook:", saveError);
              return res.status(500).send("Internal Server Error during database update");
            }
          }
          break;

        case "claim-money":
          {
            // Modified: Decrypt project acceptedmoney and title for logs
            const decryptedAcceptedMoney = eccDecrypt(project.acceptedmoney);
            const decryptedTitle = eccDecrypt(project.title);

            // Update payment
            const allPayments = await Payment.find();
            let payment = allPayments.find(p => decrypt(p.project) === project._id.toString());
            
            if (payment) {
              payment.client = project.client;
              payment.freelancer = project.acceptedFreelancer;
              payment.amount = project.acceptedmoney;
              payment.status = "Freelancer Paid";
              payment.paymentIntentId = project.paymentIntentId;
              await payment.save();
            } else {
              payment = await Payment.create({
                project: eccEncrypt(project._id.toString()),
                client: project.client,
                freelancer: project.acceptedFreelancer,
                amount: project.acceptedmoney,
                status: "Freelancer Paid",
                paymentIntentId: project.paymentIntentId,
              });
            }
            
            // Update project - Modified: Use ECC encryption for escrowStatus
            project.escrowStatus = eccEncrypt("Released");
            await project.save();
            
            // Modified: Reverted to RSA for earnings update
            const freelancerId = decrypt(project.acceptedFreelancer);
            const allFreelancerInfo = await FreelancerInformation.find();
            const freelancerInfo = allFreelancerInfo.find(fi => decrypt(fi.userId) === freelancerId);

            if (freelancerInfo) {
              const currentEarnings = parseFloat(rsaDecrypt(freelancerInfo.earnings ?? "")) || 0;
              freelancerInfo.earnings = rsaEncrypt(String(currentEarnings + parseFloat(decryptedAcceptedMoney)));
              await freelancerInfo.save();
            }
            
            // Modified: Encrypt activity log and userId
            await Activity.create({
              userId: project.acceptedFreelancer, // Already encrypted
              action: eccEncrypt(`You have claimed $${decryptedAcceptedMoney} for project "${decryptedTitle}".`),
            });
          }
          break;

        case "claim-remaining":
          {
            const clientId = session.metadata.clientId;
            
            // Update project
            project.claimStatus = "Claimed";
            await project.save();
            
            // Log activity - Modified: Encrypt userId and message
            await Activity.create({
              userId: project.client, // Already encrypted
              action: eccEncrypt(`Remaining budget claimed for project "${decrypt(project.title)}".`),
            });
          }
          break;

        case "refund-escrow":
          {
            const clientId = session.metadata.clientId;
            
            // Update payment status
            const allPayments = await Payment.find();
            const payment = allPayments.find(p => decrypt(p.project) === project._id.toString());
            
            if (payment) {
              payment.status = "Failed";
              await payment.save();
            }
            
            // Update project - Modified: Reset status to pending and escrowStatus to Not Funded
            project.escrowStatus = eccEncrypt("Not Funded");
            project.status = eccEncrypt("pending");
            await project.save();
            
            // Log activity - Modified: Encrypt userId and message
            await Activity.create({
              userId: project.client, // Already encrypted
              action: eccEncrypt(`Escrow refunded for project "${decrypt(project.title)}".`),
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
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: "Project not found." });
    }

    // Check for paymentIntentId - Modified: Decrypt for checking existence
    if (!decrypt(project.paymentIntentId)) {
      return res.status(400).json({ error: "Payment intent not found for this project." });
    }

    if (decrypt(project.approvalStatus) !== "Approved") {
      return res.status(400).json({ error: "Project is not accepted for claiming money." });
    }

    // Modified: Decrypt escrowStatus for comparison
    if (decrypt(project.escrowStatus) === "Not Funded") {
      return res.status(400).json({ error: "Escrow is not funded for this project." });
    }

    // Validate acceptedmoney - decrypt first before numeric check
    const decryptedAcceptedMoney = eccDecrypt(project.acceptedmoney);
    if (!decryptedAcceptedMoney || isNaN(parseFloat(decryptedAcceptedMoney))) {
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
              // Modified: Decrypt title for display
              name: `Claim Money for Project: ${eccDecrypt(project.title)}`,
            },
            // Modified: Decrypt acceptedmoney for amount calculation
            unit_amount: Math.round(parseFloat(eccDecrypt(project.acceptedmoney)) * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/freelancer-dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      metadata: {
        projectId: project._id.toString(),
        paymentIntentId: decrypt(project.paymentIntentId),
        freelancerId: decrypt(project.acceptedFreelancer),
        action: "claim-money",
        amount: eccDecrypt(project.acceptedmoney),
      },
    });

    res.status(200).json({ url: session.url });
    // Modified: Encrypt activity log and userId
    const decryptedTitle = eccDecrypt(project.title);
    await Activity.create({
      userId: project.acceptedFreelancer, // Already encrypted
      action: eccEncrypt(`You initiated a claim for $${decryptedAcceptedMoney} on project "${decryptedTitle}".`),
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

    // Check for paymentIntentId - Modified: Decrypt for checking existence
    if (!decrypt(project.paymentIntentId)) {
      return res.status(400).json({ error: "Payment intent not found for this project." });
    }

    if (decrypt(project.status) !== "accepted") {
      return res.status(400).json({ error: "Project is not approved for claiming the remaining budget." });
    }

    // Modified: Decrypt budget and acceptedmoney for calculation
    const remainingBudget = parseFloat(eccDecrypt(project.budget)) - parseFloat(eccDecrypt(project.acceptedmoney));

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
              // Modified: Decrypt title for display
              name: `Claim Remaining Budget for Project: ${eccDecrypt(project.title)}`,
            },
            unit_amount: Math.round(remainingBudget * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/client-dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      metadata: {
        projectId: project._id.toString(),
        paymentIntentId: decrypt(project.paymentIntentId),
        clientId: decrypt(project.client),
        action: "claim-remaining",
        amount: remainingBudget.toString(),
      },
    });

    res.status(200).json({ url: session.url });
    // Modified: Encrypt activity log and userId
    await Activity.create({
      userId: project.client, // Already encrypted
      action: eccEncrypt(`You initiated a claim for the remaining budget ($${remainingBudget}) on project "${eccDecrypt(project.title)}".`),
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

    // Check for paymentIntentId - Modified: Decrypt for checking existence
    if (!decrypt(project.paymentIntentId)) {
      return res.status(400).json({ error: "Payment intent not found for this project." });
    }

    // Modified: Decrypt escrowStatus for comparison
    if (decrypt(project.escrowStatus) !== "Funded") {
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
              // Modified: Decrypt title for display
              name: `Refund Escrow for Project: ${eccDecrypt(project.title)}`,
            },
            // Modified: Decrypt budget for amount calculation
            unit_amount: Math.round(parseFloat(eccDecrypt(project.budget)) * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/client-dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/refundCancelled`,
      metadata: {
        projectId: project._id.toString(),
        paymentIntentId: decrypt(project.paymentIntentId),
        clientId: decrypt(project.client),
        action: "refund-escrow",
        amount: eccDecrypt(project.budget),
      },
    });
    
    res.status(200).json({ url: session.url });
    // Modified: Encrypt activity log and userId
    await Activity.create({
      userId: project.client, // Already encrypted
      action: eccEncrypt(`You initiated an escrow refund for project "${eccDecrypt(project.title)}".`),
    });
  } catch (error) {
    console.error("Error processing refund escrow:", error);
    res.status(500).json({ error: "Failed to process refund escrow." });
  }
});

router.get("/verify-session/:sessionId", verifyToken, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      const projectId = session.metadata.projectId;
      const clientId = session.metadata.clientId;
      const amount = parseFloat(session.metadata.amount || "0");

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found." });
      }

      const action = session.metadata.action;

      // Check if already funded (for create-payment-intent) or already refunded (for refund-escrow)
      if (action === "create-payment-intent" && decrypt(project.escrowStatus) === "Funded") {
        return res.status(200).json({ message: "Payment already verified.", project });
      }
      if (action === "refund-escrow" && decrypt(project.escrowStatus) === "Not Funded") {
        return res.status(200).json({ message: "Refund already verified.", project });
      }

      if (action === "create-payment-intent") {
        // Update project for funding - Modified: Encrypt paymentIntentId
        project.paymentIntentId = eccEncrypt(session.id);
        project.escrowStatus = eccEncrypt("Funded");
        project.status = eccEncrypt("selected");
        await project.save();

        // Create Payment record - Modified: Encrypt paymentIntentId
        const payment = new Payment({
          project: eccEncrypt(projectId),
          client: eccEncrypt(clientId),
          amount: eccEncrypt(amount.toString()),
          status: "Succeeded",
          paymentIntentId: eccEncrypt(session.id),
        });
        await payment.save();

        // Activity log
        await Activity.create({
          userId: eccEncrypt(clientId),
          action: eccEncrypt(`Payment of $${amount} for project "${eccDecrypt(project.title)}" verified successfully.`),
        });

        return res.status(200).json({ message: "Payment verified successfully.", project });
      } else if (action === "refund-escrow") {
        // Update project for refund
        project.escrowStatus = eccEncrypt("Not Funded");
        project.status = eccEncrypt("pending");
        await project.save();

        // Update payment status if found
        const allPayments = await Payment.find();
        const payment = allPayments.find(p => decrypt(p.project) === project._id.toString());
        if (payment) {
          payment.status = "Failed";
          await payment.save();
        }

        // Activity log
        await Activity.create({
          userId: eccEncrypt(clientId),
          action: eccEncrypt(`Escrow refund for project "${eccDecrypt(project.title)}" verified successfully.`),
        });

        return res.status(200).json({ message: "Refund verified successfully.", project });
      } else if (action === "claim-money") {
        // Update project for release
        project.escrowStatus = eccEncrypt("Released");
        await project.save();

        // Update payment status
        const allPayments = await Payment.find();
        let payment = allPayments.find(p => decrypt(p.project) === project._id.toString());
        if (payment) {
          payment.status = "Freelancer Paid";
          await payment.save();
        }

        // Activity log
        await Activity.create({
          userId: project.acceptedFreelancer,
          action: eccEncrypt(`Claim of $${eccDecrypt(project.acceptedmoney)} for project "${eccDecrypt(project.title)}" verified successfully.`),
        });

        return res.status(200).json({ message: "Claim verified successfully.", project });
      } else if (action === "claim-remaining") {
        // Update project claim status
        project.claimStatus = "Claimed";
        await project.save();

        // Activity log
        await Activity.create({
          userId: project.client,
          action: eccEncrypt(`Remaining budget claim for project "${eccDecrypt(project.title)}" verified successfully.`),
        });

        return res.status(200).json({ message: "Remaining budget claim verified successfully.", project });
      }

      return res.status(200).json({ message: "Action verified.", project });
    } else {
      return res.status(400).json({ error: "Payment not completed." });
    }
  } catch (error) {
    console.error("Error verifying session:", error);
    res.status(500).json({ error: "Failed to verify session." });
  }
});

router.get("/", verifyToken, async (req, res) => {
  try {
    const allPayments = await Payment.find();
    const filteredPayments = allPayments.filter(p => decrypt(p.client) === req.user.id);
    
    // Modified: Use manual fetch for project since populate is broken
    const decryptedPayments = await Promise.all(filteredPayments.map(async (payment) => {
      const decryptedProjectId = decrypt(payment.project);
      const project = await Project.findById(decryptedProjectId);
      
      return {
        ...payment.toObject(),
        amount: decrypt(payment.amount),
        paymentIntentId: decrypt(payment.paymentIntentId),
        project: project ? {
          ...project.toObject(),
          title: decrypt(project.title),
          description: decrypt(project.description),
          escrowStatus: decrypt(project.escrowStatus),
          paymentIntentId: decrypt(project.paymentIntentId),
          approvalStatus: decrypt(project.approvalStatus),
        } : null,
      };
    }));

    res.status(200).json(decryptedPayments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Failed to fetch payments." });
  }
});

module.exports = router;