const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../smart-deal-backend/src/server.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update /api/login endpoint
const loginReplacement = `    if (!isMatch) {
      return res.status(400).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    if (user.is_2fa_enabled) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000;
      otpStore[user.email] = { otp, expiresAt, user_id: user.user_id };
      
      console.log('[OTP DEBUG] 2FA OTP for ' + user.email + ' is: ' + otp);
      
      try {
        await transporter.sendMail({
          from: '"Smart Deal Support" <no-reply@smartdeal.com>',
          to: user.email,
          subject: 'รหัส OTP ยืนยันการเข้าสู่ระบบ - Smart Deal',
          html: '<h3>รหัส OTP สำหรับเข้าสู่ระบบของคุณคือ: <b style="color: #2e7a32; font-size: 24px;">' + otp + '</b></h3><p>รหัสนี้จะหมดอายุภายใน 5 นาที</p>'
        });
      } catch (err) {
        console.log('ส่งอีเมล 2FA ไม่สำเร็จ:', err.message);
      }
      
      return res.json({
        require_2fa: true,
        email: user.email,
        message: 'กรุณายืนยันรหัส OTP ที่ส่งไปยังอีเมลของคุณ'
      });
    }

    // Check if this user is a seller (has an approved shop)`;
    
content = content.replace(`    if (!isMatch) {
      return res.status(400).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    // Check if this user is a seller (has an approved shop)`, loginReplacement);

// 2. Add /api/login/verify-2fa endpoint and /api/users/:id/2fa right after /api/login
const verify2faEndpoint = `});

// ยืนยัน OTP สำหรับ 2FA Login
app.post('/api/login/verify-2fa', async (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore[email];
  if (!record) return res.status(400).json({ message: 'ไม่มีการขอ OTP สำหรับอีเมลนี้ หรือเซสชันหมดอายุ' });
  if (Date.now() > record.expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ message: 'รหัส OTP หมดอายุแล้ว' });
  }
  if (record.otp !== otp) {
    return res.status(400).json({ message: 'รหัส OTP ไม่ถูกต้อง' });
  }
  
  try {
    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) return res.status(400).json({ message: 'ไม่พบข้อมูลผู้ใช้งาน' });
    const user = users[0];
    
    let isSeller = false;
    let shopData = null;
    const [shops] = await db.execute(
      'SELECT shop_id, name, status, image_url FROM shops WHERE owner_id = ? AND status = "approved" LIMIT 1',
      [user.user_id]
    );
    if (shops.length > 0) {
      isSeller = true;
      shopData = shops[0];
    }
    
    delete otpStore[email];
    
    res.json({
      message: 'เข้าสู่ระบบสำเร็จ!',
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        avatar_url: user.avatar_url || null,
        role: user.role,
        is_seller: isSeller,
        shop_data: shopData
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ', error: error.message });
  }
});

app.put('/api/users/:id/2fa', async (req, res) => {
  const { id } = req.params;
  const { is_2fa_enabled } = req.body;
  try {
    await db.execute('UPDATE users SET is_2fa_enabled = ? WHERE user_id = ?', [is_2fa_enabled ? 1 : 0, id]);
    res.json({ success: true, message: is_2fa_enabled ? 'เปิดใช้งาน 2FA สำเร็จ' : 'ปิดใช้งาน 2FA สำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด', error: error.message });
  }
});
`;

content = content.replace(/    \}\);\n  \} catch \(error\) \{\n    console\.error\('Login Error:', error\);\n    res\.status\(500\)\.json\(\{ message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ', error: error\.message \}\);\n  \}\n\}\);\n/, `    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ', error: error.message });
  }
` + verify2faEndpoint);

// 3. Update SELECT in GET /api/users/:id/profile and GET /api/users/:id
content = content.replace(/SELECT user_id, full_name, email, phone, avatar_url, role, status, created_at FROM users WHERE user_id = \?/g, 'SELECT user_id, full_name, email, phone, avatar_url, role, status, created_at, is_2fa_enabled FROM users WHERE user_id = ?');

fs.writeFileSync(filePath, content);
console.log('Update backend done.');
