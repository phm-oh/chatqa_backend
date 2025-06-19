const mongoose = require('mongoose');
const validator = require('validator');

const questionSchema = new mongoose.Schema({
  // ข้อมูลผู้ถาม
  name: {
    type: String,
    required: [true, 'กรุณากรอกชื่อ'],
    trim: true,
    maxLength: [100, 'ชื่อต้องไม่เกิน 100 ตัวอักษร'],
    minLength: [2, 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร']
  },
  
  email: {
    type: String,
    required: [true, 'กรุณากรอกอีเมล'],
    trim: true,
    lowercase: true,
    validate: {
      validator: validator.isEmail,
      message: 'รูปแบบอีเมลไม่ถูกต้อง'
    }
  },
  
  phone: {
    type: String,
    required: [true, 'กรุณากรอกเบอร์โทรศัพท์'],
    trim: true,
    validate: {
      validator: function(v) {
        // รองรับเบอร์ไทย เช่น 08x-xxx-xxxx, 02-xxx-xxxx
        return /^(\+66|0)[0-9]{8,9}$/.test(v.replace(/[-\s]/g, ''));
      },
      message: 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง'
    }
  },
  
  // หมวดหมู่คำถาม
  category: {
    type: String,
    required: [true, 'กรุณาเลือกหมวดหมู่'],
    enum: {
      values: ['ข้อมูลทั่วไป', 'การสมัครเรียน', 'หลักสูตร', 'สิ่งอำนวยความสะดวก', 'อื่นๆ'],
      message: 'หมวดหมู่ที่เลือกไม่ถูกต้อง'
    }
  },
  
  // คำถาม
  question: {
    type: String,
    required: [true, 'กรุณากรอกคำถาม'],
    trim: true,
    maxLength: [2000, 'คำถามต้องไม่เกิน 2000 ตัวอักษร'],
    minLength: [10, 'คำถามต้องมีอย่างน้อย 10 ตัวอักษร']
  },
  
  // คำตอบ
  answer: {
    type: String,
    trim: true,
    maxLength: [5000, 'คำตอบต้องไม่เกิน 5000 ตัวอักษร'],
    default: ''
  },
  
  // สถานะ
  status: {
    type: String,
    enum: {
      values: ['รอตอบ', 'ตอบแล้ว', 'เผยแพร่'],
      message: 'สถานะที่เลือกไม่ถูกต้อง'
    },
    default: 'รอตอบ'
  },
  
  // วันที่สร้าง (auto-generated)
  dateCreated: {
    type: Date,
    default: Date.now
  },
  
  // วันที่ตอบ
  dateAnswered: {
    type: Date,
    default: null
  },
  
  // แสดงใน FAQ หรือไม่
  showInFAQ: {
    type: Boolean,
    default: false
  },
  
  // ข้อมูลเพิ่มเติม
  adminNotes: {
    type: String,
    trim: true,
    maxLength: [1000, 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร'],
    default: ''
  },
  
  // ผู้ตอบ (อาจเป็น admin user ในอนาคต)
  answeredBy: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true, // เพิ่ม createdAt และ updatedAt อัตโนมัติ
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index สำหรับการค้นหา
questionSchema.index({ category: 1 });
questionSchema.index({ status: 1 });
questionSchema.index({ showInFAQ: 1, status: 1 });
questionSchema.index({ dateCreated: -1 });
questionSchema.index({ email: 1 });

// Virtual สำหรับการแสดงวันที่ในรูปแบบที่อ่านง่าย
questionSchema.virtual('formattedDateCreated').get(function() {
  const moment = require('moment');
  moment.locale('th');
  return moment(this.dateCreated).format('DD/MM/YYYY HH:mm');
});

questionSchema.virtual('formattedDateAnswered').get(function() {
  if (!this.dateAnswered) return null;
  const moment = require('moment');
  moment.locale('th');
  return moment(this.dateAnswered).format('DD/MM/YYYY HH:mm');
});

// Middleware: อัพเดท dateAnswered เมื่อ status เปลี่ยนเป็น 'ตอบแล้ว' หรือ 'เผยแพร่'
questionSchema.pre('save', function(next) {
  // ถ้า status เปลี่ยนเป็น 'ตอบแล้ว' หรือ 'เผยแพร่' และยังไม่มี dateAnswered
  if ((this.status === 'ตอบแล้ว' || this.status === 'เผยแพร่') && !this.dateAnswered) {
    this.dateAnswered = new Date();
  }
  
  // ถ้า status เปลี่ยนกลับเป็น 'รอตอบ' ให้ล้าง dateAnswered
  if (this.status === 'รอตอบ') {
    this.dateAnswered = null;
  }
  
  next();
});

// Static methods สำหรับการค้นหา
questionSchema.statics.getFAQQuestions = function() {
  return this.find({
    showInFAQ: true,
    status: 'เผยแพร่'
  }).sort({ dateCreated: -1 });
};

questionSchema.statics.getPendingQuestions = function() {
  return this.find({ status: 'รอตอบ' }).sort({ dateCreated: -1 });
};

questionSchema.statics.getQuestionsByCategory = function(category) {
  return this.find({ category }).sort({ dateCreated: -1 });
};

module.exports = mongoose.model('Question', questionSchema);