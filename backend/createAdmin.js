const mongoose = require('mongoose');
const User = require('./models/userModel');
const { rsaEncrypt } = require('./utils/cryptoUtils');
const { hashPassword } = require('./utils/hash');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const adminEmail = 'freelanceforge2@gmail.com';
    const adminPassword = '1234';
    const adminName = 'System Admin';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: rsaEncrypt(adminEmail) });
    if (existingAdmin) {
      console.log('Admin already exists');
      process.exit(0);
    }

    const hashedPassword = await hashPassword(adminPassword);
    
    const adminUser = new User({
      name: rsaEncrypt(adminName),
      email: rsaEncrypt(adminEmail),
      password: hashedPassword,
      role: rsaEncrypt('admin'),
      isActive: true
    });

    await adminUser.save();
    console.log('Admin user created successfully!');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
};

createAdmin();
