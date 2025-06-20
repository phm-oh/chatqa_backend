// ไฟล์: routes/question.js (แก้ไข)
const express = require('express');
const router = express.Router();
const Question = require('../models/question');
const { protect, authorize } = require('../middleware/auth');
const emailService = require('../utils/emailService'); // เพิ่มบรรทัดนี้

// @route   GET /api/questions
// @desc    Get all questions with optional filters
// @access  Public (สำหรับ admin panel)
router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      category, 
      page = 1, 
      limit = 10,
      sortBy = 'dateCreated',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Sort options
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const questions = await Question.find(filter)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count for pagination
    const total = await Question.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: questions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำถาม'
    });
  }
});

// @route   GET /api/questions/:id
// @desc    Get single question by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบคำถามที่ระบุ'
      });
    }

    res.status(200).json({
      success: true,
      data: question
    });

  } catch (error) {
    console.error('Error fetching question:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'รูปแบบ ID ไม่ถูกต้อง'
      });
    }

    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำถาม'
    });
  }
});

// @route   POST /api/questions
// @desc    Create new question และส่ง email แจ้งเตือน admin
// @access  Public
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, category, question } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !category || !question) {
      return res.status(400).json({
        success: false,
        error: 'กรุณากรอกข้อมูลให้ครบถ้วน'
      });
    }

    // Create new question
    const newQuestion = new Question({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      category,
      question: question.trim()
    });

    const savedQuestion = await newQuestion.save();

    // 🚀 ส่ง email แจ้งเตือนไป admin (ไม่ blocking)
    console.log('📧 Sending admin notification for new question...');
    emailService.sendNewQuestionAlert(savedQuestion)
      .then(result => {
        if (result.success) {
          console.log('✅ Admin notification sent:', result.messageId);
        } else {
          console.log('⚠️ Admin notification failed (non-blocking):', result.message);
        }
      })
      .catch(error => {
        console.error('❌ Admin notification error (non-blocking):', error.message);
      });

    // ส่ง response กลับทันที (ไม่รอ email)
    res.status(201).json({
      success: true,
      message: 'ส่งคำถามเรียบร้อยแล้ว เจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุด',
      data: savedQuestion
    });

  } catch (error) {
    console.error('Error creating question:', error);

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
      error: 'เกิดข้อผิดพลาดในการบันทึกคำถาม'
    });
  }
});

// @route   PUT /api/questions/:id
// @desc    Update question และส่ง email แจ้งเตือนผู้ถาม (ถ้ามีการตอบ)
// @access  Private (admin, moderator, super_admin)
router.put('/:id', protect, authorize('admin', 'moderator', 'super_admin'), async (req, res) => {
  try {
    const { answer, status, showInFAQ, adminNotes, answeredBy } = req.body;

    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบคำถามที่ระบุ'
      });
    }

    // เก็บสถานะเก่าไว้เพื่อเช็คว่ามีการเปลี่ยน status หรือไม่
    const oldStatus = question.status;
    const hadAnswer = question.answer && question.answer.trim() !== '';

    // Update fields
    if (answer !== undefined) question.answer = answer.trim();
    if (status !== undefined) question.status = status;
    if (showInFAQ !== undefined) question.showInFAQ = showInFAQ;
    if (adminNotes !== undefined) question.adminNotes = adminNotes.trim();
    if (answeredBy !== undefined) question.answeredBy = answeredBy.trim();

    const updatedQuestion = await question.save();

    // 🚀 ตรวจสอบว่าต้องส่ง email แจ้งเตือนผู้ถามหรือไม่
    const shouldNotifyUser = (
      // มีการเพิ่มคำตอบใหม่ หรือ
      (answer && answer.trim() !== '' && !hadAnswer) ||
      // status เปลี่ยนเป็น 'ตอบแล้ว' หรือ 'เผยแพร่' และมีคำตอบแล้ว
      ((status === 'ตอบแล้ว' || status === 'เผยแพร่') && 
       oldStatus === 'รอตอบ' && 
       updatedQuestion.answer && 
       updatedQuestion.answer.trim() !== '')
    );

    if (shouldNotifyUser) {
      console.log('📧 Sending user notification for answered question...');
      emailService.sendQuestionAnsweredNotification(updatedQuestion)
        .then(result => {
          if (result.success) {
            console.log('✅ User notification sent:', result.messageId);
          } else {
            console.log('⚠️ User notification failed (non-blocking):', result.message);
          }
        })
        .catch(error => {
          console.error('❌ User notification error (non-blocking):', error.message);
        });
    }

    res.status(200).json({
      success: true,
      message: 'อัพเดทข้อมูลเรียบร้อยแล้ว',
      data: updatedQuestion
    });

  } catch (error) {
    console.error('Error updating question:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'ข้อมูลไม่ถูกต้อง',
        details: errors
      });
    }

    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'รูปแบบ ID ไม่ถูกต้อง'
      });
    }

    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูล'
    });
  }
});

// @route   DELETE /api/questions/:id
// @desc    Delete question
// @access  Private (super_admin only)
router.delete('/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบคำถามที่ระบุ'
      });
    }

    await Question.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'ลบคำถามเรียบร้อยแล้ว'
    });

  } catch (error) {
    console.error('Error deleting question:', error);

    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'รูปแบบ ID ไม่ถูกต้อง'
      });
    }

    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการลบข้อมูล'
    });
  }
});

// @route   GET /api/questions/stats/dashboard
// @desc    Get dashboard statistics
// @access  Public (สำหรับ admin dashboard)
router.get('/stats/dashboard', async (req, res) => {
  try {
    const [
      totalQuestions,
      pendingQuestions,
      answeredQuestions,
      publishedQuestions,
      faqQuestions,
      categoryStats
    ] = await Promise.all([
      Question.countDocuments(),
      Question.countDocuments({ status: 'รอตอบ' }),
      Question.countDocuments({ status: 'ตอบแล้ว' }),
      Question.countDocuments({ status: 'เผยแพร่' }),
      Question.countDocuments({ showInFAQ: true, status: 'เผยแพร่' }),
      Question.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          total: totalQuestions,
          pending: pendingQuestions,
          answered: answeredQuestions,
          published: publishedQuestions,
          faq: faqQuestions
        },
        categoryStats: categoryStats.map(stat => ({
          category: stat._id,
          count: stat.count
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ'
    });
  }
});

module.exports = router;