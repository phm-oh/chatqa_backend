// Path: routes/admin.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const Admin = require('../models/admin');
const { 
  generateToken, 
  protect, 
  authorize, 
  logAdminAccess 
} = require('../middleware/auth');

// Rate limiting สำหรับ login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // จำกัด 5 ครั้งต่อ IP ใน 15 นาที
  message: {
    success: false,
    error: 'พยายามเข้าสู่ระบบมากเกินไป กรุณารออีก 15 นาที'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply logging to all admin routes
router.use(logAdminAccess);

// @route   POST /api/admin/login
// @desc    Admin login
// @access  Public
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'กรุณากรอก username และ password'
      });
    }

    // Find admin by username or email
    const admin = await Admin.findByCredentials(username);

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Username หรือ Password ไม่ถูกต้อง'
      });
    }

    // ตรวจสอบว่าบัญชีถูกล็อคหรือไม่
    if (admin.isLocked) {
      const lockTime = Math.ceil((admin.lockUntil - Date.now()) / (1000 * 60));
      return res.status(423).json({
        success: false,
        error: `บัญชีถูกล็อคชั่วคราว กรุณารออีก ${lockTime} นาที`
      });
    }

    // Compare password
    const isPasswordMatch = await admin.comparePassword(password);

    if (!isPasswordMatch) {
      // เพิ่มจำนวนครั้งที่ล็อกอินผิด
      await admin.incLoginAttempts();
      
      return res.status(401).json({
        success: false,
        error: 'Username หรือ Password ไม่ถูกต้อง'
      });
    }

    // Reset login attempts และอัพเดท last login
    await admin.resetLoginAttempts();

    // Generate token
    const token = generateToken(admin._id);

    // Set cookie (optional)
    const cookieOptions = {
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    };

    res.status(200)
       .cookie('token', token, cookieOptions)
       .json({
         success: true,
         message: 'เข้าสู่ระบบสำเร็จ',
         token,
         admin: {
           id: admin._id,
           username: admin.username,
           email: admin.email,
           fullName: admin.fullName,
           role: admin.role,
           lastLoginAt: admin.lastLoginAt
         }
       });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ'
    });
  }
});

// @route   POST /api/admin/register
// @desc    Register new admin (เฉพาะ super_admin เท่านั้น)
// @access  Private (super_admin only)
router.post('/register', protect, authorize('super_admin'), async (req, res) => {
  try {
    const { username, email, password, fullName, role = 'admin' } = req.body;

    // Validate required fields
    if (!username || !email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        error: 'กรุณากรอกข้อมูลให้ครบถ้วน'
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() }
      ]
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        error: 'Username หรือ Email นี้มีอยู่ในระบบแล้ว'
      });
    }

    // Create new admin
    const newAdmin = new Admin({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      fullName,
      role
    });

    const savedAdmin = await newAdmin.save();

    res.status(201).json({
      success: true,
      message: 'สร้างบัญชี Admin เรียบร้อยแล้ว',
      admin: {
        id: savedAdmin._id,
        username: savedAdmin.username,
        email: savedAdmin.email,
        fullName: savedAdmin.fullName,
        role: savedAdmin.role,
        isActive: savedAdmin.isActive,
        createdAt: savedAdmin.createdAt
      }
    });

  } catch (error) {
    console.error('Register error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'ข้อมูลไม่ถูกต้อง',
        details: errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการสร้างบัญชี'
    });
  }
});

// @route   GET /api/admin/me
// @desc    Get current admin profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    
    res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        isActive: admin.isActive,
        lastLoginAt: admin.lastLoginAt,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์'
    });
  }
});

// @route   PUT /api/admin/profile
// @desc    Update admin profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { fullName, email } = req.body;
    const admin = await Admin.findById(req.admin._id);

    if (fullName) admin.fullName = fullName;
    if (email && email !== admin.email) {
      // ตรวจสอบว่า email ใหม่ซ้ำกับคนอื่นไหม
      const existingAdmin = await Admin.findOne({ 
        email: email.toLowerCase(), 
        _id: { $ne: admin._id } 
      });
      
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          error: 'Email นี้มีคนใช้แล้ว'
        });
      }
      
      admin.email = email.toLowerCase();
    }

    const updatedAdmin = await admin.save();

    res.status(200).json({
      success: true,
      message: 'อัพเดทโปรไฟล์เรียบร้อยแล้ว',
      admin: {
        id: updatedAdmin._id,
        username: updatedAdmin.username,
        email: updatedAdmin.email,
        fullName: updatedAdmin.fullName,
        role: updatedAdmin.role,
        updatedAt: updatedAdmin.updatedAt
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'ข้อมูลไม่ถูกต้อง',
        details: errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการอัพเดทโปรไฟล์'
    });
  }
});

// @route   PUT /api/admin/change-password
// @desc    Change admin password
// @access  Private
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'กรุณากรอกรหัสผ่านเก่าและรหัสผ่านใหม่'
      });
    }

    // ดึงข้อมูล admin พร้อม password
    const admin = await Admin.findById(req.admin._id).select('+password');

    // ตรวจสอบรหัสผ่านเก่า
    const isCurrentPasswordValid = await admin.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'รหัสผ่านเก่าไม่ถูกต้อง'
      });
    }

    // เปลี่ยนรหัสผ่าน
    admin.password = newPassword;
    await admin.save();

    res.status(200).json({
      success: true,
      message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว'
    });

  } catch (error) {
    console.error('Change password error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'รหัสผ่านไม่ถูกต้อง',
        details: errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน'
    });
  }
});

// @route   POST /api/admin/logout
// @desc    Logout admin
// @access  Private
router.post('/logout', protect, (req, res) => {
  res.status(200)
     .cookie('token', '', {
       expires: new Date(0),
       httpOnly: true
     })
     .json({
       success: true,
       message: 'ออกจากระบบเรียบร้อยแล้ว'
     });
});

// @route   GET /api/admin/list
// @desc    Get all admins (เฉพาะ super_admin)
// @access  Private (super_admin only)
router.get('/list', protect, authorize('super_admin'), async (req, res) => {
  try {
    const { page = 1, limit = 10, role, isActive } = req.query;

    // Build filter
    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const admins = await Admin.find(filter)
      .select('-__v')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Admin.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: admins,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get admins list error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงรายชื่อ Admin'
    });
  }
});

// @route   PUT /api/admin/:id/toggle-status
// @desc    Toggle admin active status (เฉพาะ super_admin)
// @access  Private (super_admin only)
router.put('/:id/toggle-status', protect, authorize('super_admin'), async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบ Admin ที่ระบุ'
      });
    }

    // ไม่ให้แก้ไขสถานะตัวเอง
    if (admin._id.toString() === req.admin._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'ไม่สามารถแก้ไขสถานะของตัวเองได้'
      });
    }

    admin.isActive = !admin.isActive;
    await admin.save();

    res.status(200).json({
      success: true,
      message: `${admin.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'} บัญชี ${admin.username} เรียบร้อยแล้ว`,
      admin: {
        id: admin._id,
        username: admin.username,
        isActive: admin.isActive
      }
    });

  } catch (error) {
    console.error('Toggle admin status error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการแก้ไขสถานะ Admin'
    });
  }
});

// @route   GET /api/admin/stats
// @desc    Get admin statistics
// @access  Private (admin, moderator, super_admin)
router.get('/stats', protect, async (req, res) => {
  try {
    const stats = await Admin.getAdminStats();

    res.status(200).json({
      success: true,
      data: {
        adminStats: stats,
        totalAdmins: Object.values(stats).reduce((sum, count) => sum + count, 0)
      }
    });

  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงสถิติ Admin'
    });
  }
});

module.exports = router;