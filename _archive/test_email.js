const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'astotisuss@gmail.com',
    pass: 'jrmxvmhzvwekagmo'
  }
});

const sendMail = async () => {
  try {
    const info = await transporter.sendMail({
      from: 'astotisuss@gmail.com',
      to: 'astotisuss@gmail.com',
      subject: 'Test Email',
      html: '<h3>รหัส OTP ยืนยันอีเมลของคุณคือ: <b style="color: #2e7a32; font-size: 24px;">123456</b></h3><p>รหัสนี้จะหมดอายุภายใน 5 นาที</p>'
    });
    console.log('Message sent: %s', info.messageId);
  } catch (err) {
    console.error('Error sending email:', err);
  }
};

sendMail();
