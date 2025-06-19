// Path: middleware/auth.js
const jwt = require('jsonwebtoken');
const Admin = require('../models/admin');

// Generate JWT Token
const generateToken = (adminId) => {
  return jwt.sign(
    { adminId }, 
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRE || '30d',
      issuer: 'educational-chat-api'
    }
  );
};

// Verify JWT Token และ protect routes
const protect = async (req, res, next) => {
  try {
    let token;

    // ตรวจสอบ token จาก Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // หรือจาก cookie (ถ้าใช้)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // ถ้าไม่มี token
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'ไม่ได้รับอนุญาตให้เข้าถึง กรุณาเข้าสู่ระบบ'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // หา admin จาก database
      const admin = await Admin.findById(decoded.adminId);
      
      if (!admin) {
        return res.status(401).json({
          success: false,
          error: 'ไม่พบผู้ใช้งานในระบบ'
        });
      }

      // ตรวจสอบว่า admin ยังใช้งานได้หรือไม่
      if (!admin.isActive) {
        return res.status(401).json({
          success: false,
          error: 'บัญชีผู้ใช้ถูกระงับการใช้งาน'
        });
      }

      // ตรวจสอบว่าบัญชีถูกล็อคหรือไม่
      if (admin.isLocked) {
        const lockTime = Math.ceil((admin.lockUntil - Date.now()) / (1000 * 60));
        return res.status(423).json({
          success: false,
          error: `บัญชีถูกล็อค กรุณารออีก ${lockTime} นาที`
        });
      }

      // เก็บข้อมูล admin ใน req object
      req.admin = admin;
      next();

    } catch (jwtError) {
      console.error('JWT Error:', jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token หมดอายุ กรุณาเข้าสู่ระบบใหม่'
        });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Token ไม่ถูกต้อง'
        });
      }

      return res.status(401).json({
        success: false,
        error: 'ไม่ได้รับอนุญาตให้เข้าถึง'
      });
    }

  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์'
    });
  }
};

// ตรวจสอบ role ของ admin
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'ไม่ได้รับอนุญาตให้เข้าถึง'
      });
    }

    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        error: `สิทธิ์ ${req.admin.role} ไม่ได้รับอนุญาตให้ทำการนี้`
      });
    }

    next();
  };
};

// Optional auth - ถ้ามี token ก็ verify แต่ถ้าไม่มีก็ยังผ่านได้
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findById(decoded.adminId);
        
        if (admin && admin.isActive && !admin.isLocked) {
          req.admin = admin;
        }
      } catch (error) {
        // ถ้า token ไม่ถูกต้องก็ไม่เป็นไร ยังผ่านได้
        console.log('Optional auth failed:', error.message);
      }
    }

    next();
  } catch (error) {
    next();
  }
};

// Rate limiting สำหรับ login
const loginRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // จำกัด 5 ครั้งต่อ 15 นาที
  message: {
    success: false,
    error: 'พยายามเข้าสู่ระบบมากเกินไป กรุณารอ 15 นาทีแล้วลองใหม่'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // เก็บข้อมูลการเข้าถึงตาม IP
  keyGenerator: (req) => {
    return req.ip;
  }
};

// Middleware สำหรับ log การเข้าถึง admin routes
const logAdminAccess = (req, res, next) => {
  const logData = {
    timestamp: new Date().toISOString(),
    admin: req.admin ? {
      id: req.admin._id,
      username: req.admin.username,
      role: req.admin.role
    } : 'Anonymous',
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  };

  console.log('🔐 Admin Access:', JSON.stringify(logData, null, 2));
  next();
};

// Middleware สำหรับตรวจสอบ API key (สำหรับ external integrations)
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API Key is required'
    });
  }

  // ในการใช้งานจริงควรเก็บ API keys ใน database
  const validApiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
  
  if (!validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API Key'
    });
  }

  next();
};

module.exports = {
  generateToken,
  protect,
  authorize,
  optionalAuth,
  loginRateLimit,
  logAdminAccess,
  validateApiKey
};