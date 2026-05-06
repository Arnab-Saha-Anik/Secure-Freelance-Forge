const Stripe = require('stripe');
const dotenv = require("dotenv"); 
dotenv.config(); // Load environment variables from .env file
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
module.exports = stripe;
