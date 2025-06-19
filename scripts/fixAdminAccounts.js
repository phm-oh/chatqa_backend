// Path: scripts/fixAdminAccounts.js
// แก้ปัญหา admin accounts ทั้งหมด

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Admin Schema
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  role: { type: String, enum: ['admin', 'moderator', 'super_admin'], default: 'admin' },
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null }
}, { timestamps: true });

const Admin = mongoose.model('Admin', adminSchema);

const fixAdminAccounts = async () => {
  try {
    await connectDB();

    console.log('🔧 Fixing Admin Accounts...\n');

    // 1. ลบ admin accounts ทั้งหมดที่มีปัญหา
    const deletedCount = await Admin.deleteMany({});
    console.log(`🗑️  Deleted ${deletedCount.deletedCount} existing admin accounts\n`);

    // 2. สร้าง Super Admin ใหม่ที่ถูกต้อง
    const adminAccounts = [
      {
        username: 'admin',
        email: 'admin@udvc.ac.th',
        password: 'admin123',  // รหัสผ่านใหม่ที่จำง่าย
        fullName: 'ผู้ดูแลระบบหลัก',
        role: 'super_admin'
      },
      {
        username: 'moderator',
        email: 'moderator@udvc.ac.th', 
        password: 'mod123',
        fullName: 'ผู้ดูแลระบบรอง',
        role: 'moderator'
      }
    ];

    console.log('👤 Creating new admin accounts...\n');

    for (const accountData of adminAccounts) {
      try {
        // Hash password properly
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(accountData.password, saltRounds);

        // Create new admin
        const newAdmin = new Admin({
          ...accountData,
          password: hashedPassword,
          isActive: true,
          loginAttempts: 0
        });

        const savedAdmin = await newAdmin.save();

        console.log(`✅ Created ${accountData.role}: ${accountData.username}`);
        console.log(`   - Email: ${accountData.email}`);
        console.log(`   - Password: ${accountData.password}`);
        console.log(`   - ID: ${savedAdmin._id}\n`);

      } catch (error) {
        console.error(`❌ Failed to create ${accountData.username}:`, error.message);
      }
    }

    console.log('🎉 Admin accounts fixed successfully!\n');
    console.log('🔐 Login Credentials:');
    console.log('   Super Admin:');
    console.log('     - Username: admin');
    console.log('     - Password: admin123');
    console.log('   Moderator:');
    console.log('     - Username: moderator');  
    console.log('     - Password: mod123');

  } catch (error) {
    console.error('❌ Error fixing admin accounts:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
};

fixAdminAccounts();