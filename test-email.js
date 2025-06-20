// ไฟล์: safe-email-test.js
require('dotenv').config();

console.log('🧪 Safe Email Test...');
console.log('📧 EMAIL_USER:', process.env.EMAIL_USER);
console.log('📧 ADMIN_EMAIL:', process.env.ADMIN_EMAIL);
console.log('📧 EMAIL_PASS length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 'NOT SET');

// ตรวจสอบว่า nodemailer ติดตั้งแล้วหรือยัง
console.log('\n📦 Checking nodemailer...');

let nodemailer;
try {
  nodemailer = require('nodemailer');
  console.log('✅ nodemailer loaded successfully');
  
  // ตรวจสอบ version
  try {
    const packageInfo = require('nodemailer/package.json');
    console.log('📦 nodemailer version:', packageInfo.version);
  } catch (e) {
    console.log('📦 nodemailer version: unknown');
  }
  
} catch (error) {
  console.error('❌ nodemailer not found:', error.message);
  console.log('\n💡 To fix this:');
  console.log('   npm install nodemailer');
  console.log('\n💡 If that fails, try:');
  console.log('   npm cache clean --force');
  console.log('   npm install nodemailer');
  process.exit(1);
}

// ตรวจสอบว่า createTransport มีอยู่หรือไม่
console.log('\n🔧 Checking createTransport function...');
if (typeof nodemailer.createTransport === 'function') {
  console.log('✅ createTransport function exists');
  testEmailSending();
} else {
  console.error('❌ createTransport is not a function');
  console.log('🔍 Available methods:', Object.keys(nodemailer));
  console.log('\n💡 This usually means nodemailer is corrupted');
  console.log('💡 Try reinstalling:');
  console.log('   npm uninstall nodemailer');
  console.log('   npm install nodemailer');
}

async function testEmailSending() {
  try {
    console.log('\n🔧 Creating transporter...');
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      debug: true, // เปิด debug mode
      logger: true // เปิด logger
    });

    console.log('✅ Transporter created successfully');

    console.log('\n🔌 Testing SMTP connection...');
    const verified = await transporter.verify();
    
    if (verified) {
      console.log('✅ SMTP connection verified!');
      
      console.log('\n📬 Sending test email...');
      const result = await transporter.sendMail({
        from: {
          name: 'ระบบ FAQ Test',
          address: process.env.EMAIL_USER
        },
        to: process.env.ADMIN_EMAIL,
        subject: '🧪 Email Test - ระบบทำงานแล้ว!',
        text: `ระบบ Email ทำงานสำเร็จ!\nทดสอบเมื่อ: ${new Date().toLocaleString('th-TH')}`,
        html: `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="color: #4CAF50;">🎉 ระบบ Email ทำงานสำเร็จ!</h2>
          <p>การตั้งค่าถูกต้องแล้ว</p>
          <p><strong>ทดสอบเมื่อ:</strong> ${new Date().toLocaleString('th-TH')}</p>
          <p><strong>ส่งจาก:</strong> ${process.env.EMAIL_USER}</p>
          <p><strong>ส่งถึง:</strong> ${process.env.ADMIN_EMAIL}</p>
          <hr>
          <p style="color: #666;">🏫 ระบบ FAQ มหาวิทยาลัยราชภัฏอุดรธานี</p>
        </div>
        `
      });

      console.log('🎉 Test email sent successfully!');
      console.log('📧 Message ID:', result.messageId);
      console.log('📬 Check your email at:', process.env.ADMIN_EMAIL);
      console.log('\n✅ Email system is fully working!');
      
    } else {
      console.log('❌ SMTP verification failed');
    }

  } catch (error) {
    console.error('\n❌ Email test failed:', error.message);
    console.error('🔍 Error code:', error.code);
    
    if (error.code === 'EAUTH') {
      console.log('\n🔑 Gmail Authentication Failed!');
      console.log('💡 You need to create a Gmail App Password:');
      console.log('   1. Go to: https://myaccount.google.com/security');
      console.log('   2. Enable 2-Step Verification');
      console.log('   3. Create App Password for "Mail"');
      console.log('   4. Use the 16-digit password (remove spaces)');
      console.log('   5. Update EMAIL_PASS in .env file');
      console.log('   6. Restart the server');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNECTION') {
      console.log('\n🌐 Network connection issue');
      console.log('💡 Check your internet connection');
    } else {
      console.log('\n🔧 Unknown error occurred');
      console.log('💡 Check all email settings in .env file');
    }
  }
}