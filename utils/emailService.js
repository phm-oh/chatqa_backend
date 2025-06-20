const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.init();
  }

  // ตั้งค่า email transporter
  init() {
    try {
      this.transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false, // true สำหรับ 465, false สำหรับ port อื่น
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      console.log('✅ Email service initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing email service:', error);
    }
  }

  // ส่ง email แจ้งเตือน admin เมื่อมีคำถามใหม่
  async sendNewQuestionAlert(questionData) {
    try {
      // ตรวจสอบว่าเปิดใช้งาน email notifications หรือไม่
      if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'false') {
        console.log('📧 Email notifications disabled - skipping admin alert');
        return { success: false, message: 'Email notifications disabled' };
      }

      if (!this.transporter) {
        console.log('⚠️ Email transporter not initialized - skipping admin alert');
        return { success: false, message: 'Email transporter not available' };
      }

      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        console.log('⚠️ Admin email not configured - skipping admin alert');
        return { success: false, message: 'Admin email not configured' };
      }

      // สร้าง HTML template สำหรับ email
      const htmlContent = this.createNewQuestionTemplate(questionData);

      const mailOptions = {
        from: {
          name: 'ระบบ FAQ UDVC',
          address: process.env.EMAIL_USER
        },
        to: adminEmail,
        subject: `🔔 มีคำถามใหม่เข้ามา - ${questionData.category}`,
        html: htmlContent,
        text: this.createPlainTextVersion(questionData)
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Admin notification sent successfully:', result.messageId);
      return { 
        success: true, 
        messageId: result.messageId,
        message: 'Admin notification sent successfully' 
      };

    } catch (error) {
      console.error('❌ Error sending admin notification (non-blocking):', error.message);
      // ไม่ให้ error นี้ทำให้ระบบหลักล้มเหลว
      return { 
        success: false, 
        error: error.message,
        message: 'Failed to send admin notification but system continues normally' 
      };
    }
  }

  // สร้าง HTML template สำหรับ email แจ้งเตือน
  createNewQuestionTemplate(data) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { padding: 30px; }
            .info-row { margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea; }
            .label { font-weight: bold; color: #333; margin-bottom: 5px; }
            .value { color: #666; }
            .question-box { background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; border-radius: 0 0 10px 10px; }
            .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
            .priority { background: #ff9800; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔔 คำถามใหม่เข้ามาแล้ว!</h1>
                <p>มีคำถามใหม่รอการตอบจากคุณ</p>
            </div>
            
            <div class="content">
                <div class="info-row">
                    <div class="label">👤 ชื่อผู้ถาม:</div>
                    <div class="value">${data.name}</div>
                </div>
                
                <div class="info-row">
                    <div class="label">📧 อีเมล:</div>
                    <div class="value">${data.email}</div>
                </div>
                
                <div class="info-row">
                    <div class="label">📱 เบอร์โทร:</div>
                    <div class="value">${data.phone}</div>
                </div>
                
                <div class="info-row">
                    <div class="label">📂 หมวดหมู่:</div>
                    <div class="value">
                        <span class="priority">${data.category}</span>
                    </div>
                </div>
                
                <div class="question-box">
                    <div class="label">❓ คำถาม:</div>
                    <div style="margin-top: 10px; font-size: 16px; line-height: 1.6; color: #333;">
                        ${data.question}
                    </div>
                </div>
                
                <div class="info-row">
                    <div class="label">🕐 วันที่ส่ง:</div>
                    <div class="value">${new Date(data.dateCreated).toLocaleString('th-TH')}</div>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/questions" class="btn">
                        📋 ไปตอบคำถาม
                    </a>
                </div>
            </div>
            
            <div class="footer">
                <p>📧 Email นี้ส่งโดยระบบ FAQ อัตโนมัติ</p>
                <p>🏫 มหาวิทยาลัยราชภัฏอุดรธานี</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  // สร้าง plain text version
  createPlainTextVersion(data) {
    return `
🔔 มีคำถามใหม่เข้ามาแล้ว!

👤 ชื่อผู้ถาม: ${data.name}
📧 อีเมล: ${data.email}
📱 เบอร์โทร: ${data.phone}
📂 หมวดหมู่: ${data.category}
🕐 วันที่ส่ง: ${new Date(data.dateCreated).toLocaleString('th-TH')}

❓ คำถาม:
${data.question}

กรุณาเข้าไปตอบคำถามใน Admin Panel
    `;
  }

  // ส่ง email แจ้งเตือนเมื่อมีการตอบคำถาม (สำหรับผู้ถาม)
  async sendQuestionAnsweredNotification(questionData) {
    try {
      if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'false') {
        console.log('📧 Email notifications disabled - skipping user notification');
        return { success: false, message: 'Email notifications disabled' };
      }

      if (!this.transporter) {
        console.log('⚠️ Email transporter not initialized - skipping user notification');
        return { success: false, message: 'Email transporter not available' };
      }

      // ตรวจสอบว่ามี email ของผู้ถามหรือไม่
      if (!questionData.email) {
        console.log('⚠️ User email not found - skipping user notification');
        return { success: false, message: 'User email not provided' };
      }

      const htmlContent = this.createAnsweredTemplate(questionData);

      const mailOptions = {
        from: {
          name: 'ระบบ FAQ UDVC',
          address: process.env.EMAIL_USER
        },
        to: questionData.email,
        subject: `✅ คำถามของคุณได้รับการตอบแล้ว - ${questionData.category}`,
        html: htmlContent,
        text: `คำถาม: ${questionData.question}\n\nคำตอบ: ${questionData.answer}`,
        // เพิ่ม options สำหรับจัดการ email ที่ไม่ถูกต้อง
        dsn: {
          id: 'question-' + questionData._id,
          return: 'headers',
          notify: 'never', // ไม่ส่ง bounce notification กลับ
          recipient: questionData.email
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ User notification sent successfully:', result.messageId);
      return { 
        success: true, 
        messageId: result.messageId,
        message: 'User notification sent successfully'
      };

    } catch (error) {
      console.error('❌ Error sending user notification (non-blocking):', {
        message: error.message,
        code: error.code,
        response: error.response,
        userEmail: questionData.email
      });
      
      // จัดการ error แบบต่างๆ
      let errorMessage = 'Failed to send user notification but system continues normally';
      
      if (error.code === 'EENVELOPE' || error.responseCode === 550) {
        errorMessage = 'Invalid recipient email address - notification skipped';
        console.log(`📧 Invalid email detected: ${questionData.email} - continuing normally`);
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNECTION') {
        errorMessage = 'Email server connection failed - notification skipped';
        console.log('📧 Email server connection failed - continuing normally');
      }
      
      // ไม่ให้ error นี้ทำให้ระบบหลักล้มเหลว - สำคัญมาก!
      return { 
        success: false, 
        error: error.message,
        code: error.code,
        message: errorMessage
      };
    }
  }

  // Template สำหรับแจ้งว่าคำถามได้รับการตอบแล้ว
  createAnsweredTemplate(data) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { padding: 30px; }
            .question-box { background: #f3e5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9c27b0; }
            .answer-box { background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; border-radius: 0 0 10px 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✅ คำถามของคุณได้รับการตอบแล้ว!</h1>
                <p>เรียน คุณ${data.name}</p>
            </div>
            
            <div class="content">
                <div class="question-box">
                    <h3>❓ คำถามของคุณ:</h3>
                    <p>${data.question}</p>
                </div>
                
                <div class="answer-box">
                    <h3>💬 คำตอบ:</h3>
                    <p>${data.answer}</p>
                </div>
                
                <p><strong>หมวดหมู่:</strong> ${data.category}</p>
                <p><strong>วันที่ตอบ:</strong> ${new Date(data.dateAnswered).toLocaleString('th-TH')}</p>
            </div>
            
            <div class="footer">
                <p>ขอบคุณที่ใช้บริการระบบ FAQ</p>
                <p>🏫 มหาวิทยาลัยราชภัฏอุดรธานี</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  // ทดสอบการส่ง email
  async testConnection() {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      await this.transporter.verify();
      console.log('✅ Email service connection test successful');
      return { success: true, message: 'Email service is working' };
    } catch (error) {
      console.error('❌ Email service connection test failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
module.exports = new EmailService();