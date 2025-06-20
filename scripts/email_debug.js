// ไฟล์: quick-debug.js (สร้างใหม่ในโฟลเดอร์หลัก)
require('dotenv').config();

console.log('🔍 Quick Email Debug Check:');
console.log('==================================');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('ENABLE_EMAIL_NOTIFICATIONS:', process.env.ENABLE_EMAIL_NOTIFICATIONS);
console.log('Type of ENABLE_EMAIL_NOTIFICATIONS:', typeof process.env.ENABLE_EMAIL_NOTIFICATIONS);
console.log('ENABLE_EMAIL_NOTIFICATIONS === "true":', process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true');
console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? `${process.env.EMAIL_PASS.substring(0,4)}****` : 'NOT SET');
console.log('==================================');

// ทดสอบการสร้าง nodemailer
console.log('\n📧 Testing Nodemailer Setup...');
try {
  const nodemailer = require('nodemailer');
  
  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  console.log('✅ Transporter created successfully');
  
  // ทดสอบการเชื่อมต่อ
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ SMTP Connection Failed:', error.message);
      if (error.code === 'EAUTH') {
        console.log('💡 Hint: This is usually an authentication problem');
        console.log('💡 Try generating a new Gmail App Password');
      }
    } else {
      console.log('✅ SMTP Connection Successful!');
      
      // ทดสอบส่ง email จริง
      console.log('\n📬 Sending test email...');
      const testEmail = {
        from: {
          name: 'ระบบ FAQ Test',
          address: process.env.EMAIL_USER
        },
        to: process.env.ADMIN_EMAIL,
        subject: '🧪 Test Email - ระบบทำงานปกติ',
        html: `
        <h2>🧪 การทดสอบระบบ Email</h2>
        <p>ถ้าคุณเห็น email นี้แสดงว่าระบบทำงานปกติแล้ว!</p>
        <p><strong>เวลาทดสอบ:</strong> ${new Date().toLocaleString('th-TH')}</p>
        <p>🎉 ระบบ FAQ พร้อมใช้งาน!</p>
        `,
        text: 'การทดสอบระบบ Email สำเร็จ!'
      };

      transporter.sendMail(testEmail, (error, info) => {
        if (error) {
          console.error('❌ Test Email Failed:', error.message);
        } else {
          console.log('✅ Test Email Sent Successfully!');
          console.log('📧 Message ID:', info.messageId);
          console.log('📬 Check your email:', process.env.ADMIN_EMAIL);
        }
        process.exit(0);
      });
    }
  });

} catch (error) {
  console.error('❌ Failed to setup email test:', error.message);
  process.exit(1);
}