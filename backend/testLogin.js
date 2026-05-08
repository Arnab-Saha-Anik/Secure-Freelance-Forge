const { rsaEncrypt } = require('./utils/cryptoUtils');
const { comparePassword } = require('./utils/hash');
const mongoose = require('mongoose');
const User = require('./models/userModel');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const testLogin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const email = 'admin@example.com';
    const password = 'AdminPassword123!';
    const role = 'admin';

    const encryptedEmail = rsaEncrypt(email);
    console.log('Testing Email:', email);
    console.log('Encrypted Search Email:', encryptedEmail);

    const user = await User.findOne({ email: encryptedEmail });
    if (!user) {
      console.log('User NOT found');
      // Let's try to find ANY admin and see their encrypted email
      const anyAdmin = await User.findOne({ role: /rsa_/ });
      if (anyAdmin) {
        console.log('Found an admin in DB with email:', anyAdmin.email);
        if (anyAdmin.email === encryptedEmail) {
           console.log('Match! But findOne failed? This is weird.');
        } else {
           console.log('Mismatch! DB has different encrypted email.');
        }
      }
    } else {
      console.log('User found!');
      const isMatch = await comparePassword(password, user.password);
      console.log('Password match:', isMatch);
      // Check role
      const { rsaDecrypt } = require('./utils/cryptoUtils');
      const decryptedRole = rsaDecrypt(user.role);
      console.log('Decrypted Role:', decryptedRole);
      console.log('Role match:', decryptedRole.toLowerCase() === role.toLowerCase());
    }
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
};

testLogin();
