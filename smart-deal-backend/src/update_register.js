const fs = require('fs');
let c = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8');

const oldReg = /\/\/ สมัครสมาชิก\r?\napp\.post\('\/api\/register', async \(req, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ message: 'เกิดข้อผิดพลาดในการสมัครสมาชิก', error: error\.message \}\);\r?\n  \}\r?\n\}\);\r?\n/;

const newReg = `// สมัครสมาชิก (ขอ OTP)
app.post('/api/register/request-otp', async (req, res) => {
  const { email, phone } = req.body;
  try {
    const [existing] = await db.execute(
      'SELECT * FROM users WHERE email = ? OR phone = ?',
      [email, phone]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: 'อีเมลหรือเบอร์โทรศัพท์นี้ถูกใช้งานแล้ว' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    otpStore[email] = { otp, expiresAt };
    console.log('[OTP DEBUG] รหัส OTP สมัครสมาชิกของ ' + email + ' คือ: ' + otp);

    await transporter.sendMail({
      from: '"Smart Deal Support" <no-reply@smartdeal.com>',
      to: email,
      subject: 'รหัส OTP สำหรับยืนยันการสมัครสมาชิก - Smart Deal',
      html: '<h3>รหัส OTP ยืนยันอีเมลของคุณคือ: <b style="color: #2e7a32; font-size: 24px;">' + otp + '</b></h3><p>รหัสนี้จะหมดอายุภายใน 5 นาที</p>'
    }).catch(err => console.log('ส่งอีเมลไม่สำเร็จ:', err.message));

    res.json({ message: 'ส่งรหัส OTP ไปยังอีเมลเรียบร้อยแล้ว' });
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดทางเซิร์ฟเวอร์', error: error.message });
  }
});

// สมัครสมาชิก (ยืนยัน OTP)
app.post('/api/register', async (req, res) => {
  const { email, phone, password, full_name, role = 'buyer', otp } = req.body;

  try {
    const record = otpStore[email];
    if (!record) return res.status(400).json({ message: 'กรุณาขอรหัส OTP สำหรับการสมัครสมาชิก' });
    if (Date.now() > record.expiresAt) {
      delete otpStore[email];
      return res.status(400).json({ message: 'รหัส OTP หมดอายุแล้ว' });
    }
    if (record.otp !== otp) {
      return res.status(400).json({ message: 'รหัส OTP ไม่ถูกต้อง' });
    }

    const [existing] = await db.execute(
      'SELECT * FROM users WHERE email = ? OR phone = ?',
      [email, phone]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: 'อีเมลหรือเบอร์โทรศัพท์นี้ถูกใช้งานแล้ว' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const [result] = await db.execute(
      'INSERT INTO users (email, phone, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, ?, "active")',
      [email, phone, password_hash, full_name, role]
    );

    delete otpStore[email];

    res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ!', user_id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสมัครสมาชิก', error: error.message });
  }
});
`;

c = c.replace(oldReg, newReg);
fs.writeFileSync('c:/smartdeal/smart-deal-backend/src/server.js', c);
