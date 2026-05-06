# Freelance-Forge

Steps:
1. npm install to install all the dependencies
2. cd backend
3. make a .env file and put these
   
PORT=5000

MONGO_URI=MONGO_URI=make it from mongodb atlas

# use co pilot to generate these keys given below

JWT_SECRET=your_jwt_secret

STRIPE_SECRET_KEY=your_stripe_secret_key

stripe listen --forward-to localhost:5000/payments/webhook