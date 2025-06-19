const express = require('express');
const router = express.Router();
const Question = require('../models/question');

// @route   GET /api/faq
// @desc    Get all FAQ questions (Show in FAQ ✅ AND Status = เผยแพร่)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { 
      category, 
      page = 1, 
      limit = 20,
      search 
    } = req.query;

    // Build filter object สำหรับ FAQ
    const filter = {
      showInFAQ: true,
      status: 'เผยแพร่'
    };

    // เพิ่มเงื่อนไขหมวดหมู่ถ้ามี
    if (category && category !== 'all') {
      filter.category = category;
    }

    // เพิ่มเงื่อนไขการค้นหา
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { question: searchRegex },
        { answer: searchRegex }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const faqQuestions = await Question.find(filter)
      .select('question answer category dateCreated dateAnswered') // เลือกเฉพาะ field ที่ต้องการ
      .sort({ dateCreated: -1 }) // เรียงตามวันที่สร้างล่าสุด
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count for pagination
    const total = await Question.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: faqQuestions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching FAQ questions:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูล FAQ'
    });
  }
});

// @route   GET /api/faq/categories
// @desc    Get FAQ categories with question counts
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categoryStats = await Question.aggregate([
      {
        $match: {
          showInFAQ: true,
          status: 'เผยแพร่'
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // เพิ่มหมวด "ทั้งหมด" ไว้ด้านบน
    const totalCount = categoryStats.reduce((sum, cat) => sum + cat.count, 0);
    
    const categories = [
      {
        category: 'all',
        name: 'ทั้งหมด',
        count: totalCount
      },
      ...categoryStats.map(stat => ({
        category: stat._id,
        name: stat._id,
        count: stat.count
      }))
    ];

    res.status(200).json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('Error fetching FAQ categories:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลหมวดหมู่'
    });
  }
});

// @route   GET /api/faq/popular
// @desc    Get most popular FAQ questions (latest 10)
// @access  Public
router.get('/popular', async (req, res) => {
  try {
    const popularQuestions = await Question.find({
      showInFAQ: true,
      status: 'เผยแพร่'
    })
    .select('question answer category dateCreated')
    .sort({ dateCreated: -1 })
    .limit(10);

    res.status(200).json({
      success: true,
      data: popularQuestions
    });

  } catch (error) {
    console.error('Error fetching popular FAQ questions:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูล FAQ ยอดนิยม'
    });
  }
});

// @route   GET /api/faq/:id
// @desc    Get single FAQ question by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const faqQuestion = await Question.findOne({
      _id: req.params.id,
      showInFAQ: true,
      status: 'เผยแพร่'
    }).select('question answer category dateCreated dateAnswered');

    if (!faqQuestion) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบ FAQ ที่ระบุ'
      });
    }

    res.status(200).json({
      success: true,
      data: faqQuestion
    });

  } catch (error) {
    console.error('Error fetching FAQ question:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'รูปแบบ ID ไม่ถูกต้อง'
      });
    }

    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูล FAQ'
    });
  }
});

// @route   GET /api/faq/search/:query
// @desc    Search FAQ questions
// @access  Public
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'คำค้นหาต้องมีอย่างน้อย 2 ตัวอักษร'
      });
    }

    const searchRegex = new RegExp(query.trim(), 'i');
    const filter = {
      showInFAQ: true,
      status: 'เผยแพร่',
      $or: [
        { question: searchRegex },
        { answer: searchRegex }
      ]
    };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const searchResults = await Question.find(filter)
      .select('question answer category dateCreated')
      .sort({ dateCreated: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Question.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: searchResults,
      searchQuery: query,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error searching FAQ questions:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในการค้นหา FAQ'
    });
  }
});

module.exports = router;