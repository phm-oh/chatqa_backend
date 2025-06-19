// Path: scripts/createSuperAdmin.js
// วิธีใช้: node scripts/createSuperAdmin.js

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');

// Import models
const Admin = require('../models/admin');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // ตรวจสอบว่ามี Super Admin อยู่แล้วหรือไม่
    const existingSuperAdmin = await Admin.findOne({ role: 'super_admin' });
    
    if (existingSuperAdmin) {
      console.log('❌ Super Admin already exists!');
      console.log('Existing Super Admin:', existingSuperAdmin.username);
      process.exit(1);
    }

    console.log('🔧 Creating Super Admin Account...\n');

    // รับข้อมูลจากผู้ใช้
    const username = await question('Username: ');
    const email = await question('Email: ');
    const fullName = await question('Full Name: ');
    
    // รับ password แบบซ่อน (ง่ายๆ)
    const password = await question('Password: ');
    const confirmPassword = await question('Confirm Password: ');

    if (password !== confirmPassword) {
      console.log('❌ Passwords do not match!');
      process.exit(1);
    }

    if (password.length < 6) {
      console.log('❌ Password must be at least 6 characters!');
      process.exit(1);
    }

    // ตรวจสอบว่า username หรือ email ซ้ำไหม
    const existingAdmin = await Admin.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() }
      ]
    });

    if (existingAdmin) {
      console.log('❌ Username or Email already exists!');
      process.exit(1);
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // สร้าง Super Admin
    const superAdmin = new Admin({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: hashedPassword,
      fullName: fullName,
      role: 'super_admin',
      isActive: true
    });

    // บันทึกลง database (ข้าม pre-save middleware)
    const savedAdmin = await superAdmin.save();

    console.log('\n✅ Super Admin created successfully!');
    console.log('📋 Details:');
    console.log(`   - ID: ${savedAdmin._id}`);
    console.log(`   - Username: ${savedAdmin.username}`);
    console.log(`   - Email: ${savedAdmin.email}`);
    console.log(`   - Full Name: ${savedAdmin.fullName}`);
    console.log(`   - Role: ${savedAdmin.role}`);
    console.log(`   - Created At: ${savedAdmin.createdAt}`);

    console.log('\n🔐 You can now login with:');
    console.log(`   - Username: ${savedAdmin.username}`);
    console.log(`   - Password: [the password you entered]`);

  } catch (error) {
    console.error('❌ Error creating Super Admin:', error.message);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      console.log('Validation Errors:', errors);
    }
  } finally {
    rl.close();
    mongoose.connection.close();
    process.exit(0);
  }
};

createSuperAdmin();