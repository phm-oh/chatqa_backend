// Path: models/admin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const adminSchema = new mongoose.Schema({
  // ข้อมูลพื้นฐาน
  username: {
    type: String,
    required: [true, 'กรุณากรอก username'],
    unique: true,
    trim: true,
    lowercase: true,
    minLength: [3, 'Username ต้องมีอย่างน้อย 3 ตัวอักษร'],
    maxLength: [50, 'Username ต้องไม่เกิน 50 ตัวอักษร'],
    validate: {
      validator: function(v) {
        // อนุญาตเฉพาะตัวอักษร ตัวเลข และ underscore
        return /^[a-zA-Z0-9_]+$/.test(v);
      },
      message: 'Username ใช้ได้เฉพาะตัวอักษร ตัวเลข และ _ เท่านั้น'
    }
  },
  
  email: {
    type: String,
    required: [true, 'กรุณากรอกอีเมล'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: validator.isEmail,
      message: 'รูปแบบอีเมลไม่ถูกต้อง'
    }
  },
  
  password: {
    type: String,
    required: [true, 'กรุณากรอกรหัสผ่าน'],
    minLength: [6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'],
    select: false // ไม่แสดงเมื่อ query โดยปกติ
  },
  
  // ข้อมูลส่วนตัว
  fullName: {
    type: String,
    required: [true, 'กรุณากรอกชื่อเต็ม'],
    trim: true,
    maxLength: [100, 'ชื่อเต็มต้องไม่เกิน 100 ตัวอักษร']
  },
  
  // สิทธิ์การใช้งาน
  role: {
    type: String,
    enum: {
      values: ['admin', 'moderator', 'super_admin'],
      message: 'Role ที่เลือกไม่ถูกต้อง'
    },
    default: 'admin'
  },
  
  // สถานะการใช้งาน
  isActive: {
    type: Boolean,
    default: true
  },
  
  // วันที่ล็อกอินล่าสุด
  lastLoginAt: {
    type: Date,
    default: null
  },
  
  // จำนวนครั้งที่ล็อกอินผิด
  loginAttempts: {
    type: Number,
    default: 0
  },
  
  // เวลาที่ถูกล็อคบัญชี
  lockUntil: {
    type: Date,
    default: null
  },
  
  // Token สำหรับ reset password
  resetPasswordToken: {
    type: String,
    default: null
  },
  
  resetPasswordExpire: {
    type: Date,
    default: null
  }
}, {
  timestamps: true, // createdAt, updatedAt
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.resetPasswordToken;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Virtual สำหรับตรวจสอบว่าบัญชีถูกล็อคหรือไม่
adminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Index สำหรับการค้นหา
adminSchema.index({ username: 1 });
adminSchema.index({ email: 1 });
adminSchema.index({ isActive: 1 });
adminSchema.index({ role: 1 });

// Pre-save middleware: Hash password
adminSchema.pre('save', async function(next) {
  // ถ้าไม่ได้แก้ไข password ก็ไม่ต้อง hash ใหม่
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method: Compare password
adminSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน');
  }
};

// Instance method: Increment login attempts
adminSchema.methods.incLoginAttempts = async function() {
  // ถ้ามี lockUntil และยังไม่หมดเวลา
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        loginAttempts: 1,
        lockUntil: 1
      }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // ถ้าพยายามล็อกอินผิดเกิน 5 ครั้ง ให้ล็อคบัญชี 2 ชั่วโมง
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
    };
  }
  
  return this.updateOne(updates);
};

// Instance method: Reset login attempts
adminSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockUntil: 1
    },
    $set: {
      lastLoginAt: new Date()
    }
  });
};

// Static method: Find admin by username or email
adminSchema.statics.findByCredentials = async function(identifier) {
  const admin = await this.findOne({
    $or: [
      { username: identifier.toLowerCase() },
      { email: identifier.toLowerCase() }
    ],
    isActive: true
  }).select('+password');
  
  return admin;
};

// Static method: Create super admin (for initial setup)
adminSchema.statics.createSuperAdmin = async function(userData) {
  const existingSuperAdmin = await this.findOne({ role: 'super_admin' });
  
  if (existingSuperAdmin) {
    throw new Error('Super Admin already exists');
  }
  
  const superAdmin = new this({
    ...userData,
    role: 'super_admin',
    isActive: true
  });
  
  return superAdmin.save();
};

// Static method: Get active admins count by role
adminSchema.statics.getAdminStats = async function() {
  const stats = await this.aggregate([
    {
      $match: { isActive: true }
    },
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }
  ]);
  
  return stats.reduce((acc, stat) => {
    acc[stat._id] = stat.count;
    return acc;
  }, {});
};

module.exports = mongoose.model('Admin', adminSchema);