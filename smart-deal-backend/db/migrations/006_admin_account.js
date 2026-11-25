// 006: บัญชีผู้ดูแลระบบตั้งต้น (สร้างเฉพาะเมื่อยังไม่มีแอดมินในระบบ)
// ตั้งค่าได้ผ่าน .env: ADMIN_DEFAULT_EMAIL / ADMIN_DEFAULT_PASSWORD / ADMIN_DEFAULT_NAME
const bcrypt = require('bcryptjs');

module.exports = {
  name: '006_admin_account',
  async up(conn) {
    const [admins] = await conn.query("SELECT user_id FROM users WHERE role = 'admin' LIMIT 1");
    if (admins.length) return;
    const email = process.env.ADMIN_DEFAULT_EMAIL || 'admin@smartdeal.com';
    const password = process.env.ADMIN_DEFAULT_PASSWORD || 'admin1234';
    const name = process.env.ADMIN_DEFAULT_NAME || 'ผู้ดูแลระบบ Smart Deal';
    const hash = await bcrypt.hash(password, 10);
    const [exists] = await conn.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (exists.length) {
      await conn.query("UPDATE users SET role = 'admin', status = 'active' WHERE user_id = ?", [exists[0].user_id]);
    } else {
      await conn.query("INSERT INTO users (email, phone, password_hash, full_name, role, status) VALUES (?, NULL, ?, ?, 'admin', 'active')", [email, hash, name]);
    }
    console.log(`👤 [Migration 006] สร้างบัญชีแอดมินตั้งต้น: ${email} (กรุณาเปลี่ยนรหัสผ่านหลังเข้าใช้งาน)`);
  },
};
