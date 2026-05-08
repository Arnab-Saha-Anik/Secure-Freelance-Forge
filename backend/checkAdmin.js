const mongoose = require('mongoose');
const User = require('./models/userModel');
const { decrypt } = require('./utils/cryptoUtils');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const checkAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in database:', collections.map(c => c.name));

    const allUsers = await User.find();
    console.log('Total users:', allUsers.length);

    for (const user of allUsers) {
      try {
        const decryptedRole = decrypt(user.role);
        if (decryptedRole && decryptedRole.toLowerCase() === 'admin') {
          console.log('Found Admin User:');
          console.log('ID:', user._id);
          console.log('Encrypted Email:', user.email);
          console.log('Decrypted Email:', decrypt(user.email));
          console.log('Encrypted Role:', user.role);
          console.log('Decrypted Role:', decryptedRole);
          console.log('Is Active:', user.isActive);
        }
      } catch (e) {
        // Skip users with invalid role format
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error checking admin:', error);
    process.exit(1);
  }
};

checkAdmin();
