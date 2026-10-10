const express = require('express');
const { Expo } = require('expo-server-sdk');
let expo = new Expo();
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const generatePayload = require('promptpay-qr');
const QRCode = require('qrcode');
const db = require('./db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const otpStore = {};

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  connectionTimeout: 3000,
  greetingTimeout: 3000,
  socketTimeout: 3000,
  tls: { rejectUnauthorized: false },
  auth: {
    user: process.env.EMAIL_USER || 'astotisuss@gmail.com',
    pass: process.env.EMAIL_PASS || 'jrmxvmhzvwekagmo'
  }
});

const app = express();
app.use(cors());

// ==========================================
// AUTO-MIGRATION: Reviews & Rating System
// ==========================================
(async () => {
  try {
    const [cols] = await db.query("SHOW COLUMNS FROM reviews LIKE 'rider_rating'");
    if (cols.length === 0) {
      console.log('🔄 [Migration] Adding rider columns to reviews table...');
      try { await db.query("ALTER TABLE reviews ADD COLUMN rider_id INT NULL"); } catch(e){}
      try { await db.query("ALTER TABLE reviews ADD COLUMN rider_rating TINYINT NULL"); } catch(e){}
      try { await db.query("ALTER TABLE reviews ADD COLUMN rider_comment TEXT NULL"); } catch(e){}
      console.log('✅ [Migration] reviews table updated for rider rating.');
    }
  } catch (err) {
    console.log('Notice: auto-migration check:', err.message);
  }
})();

app.get('/api/admin/migrate-rating-system', async (req, res) => {
  try {
    const changes = [];
    const [cols] = await db.query("SHOW COLUMNS FROM reviews LIKE 'rider_rating'");
    if (cols.length === 0) {
      try { await db.query("ALTER TABLE reviews ADD COLUMN rider_id INT NULL"); changes.push('added rider_id'); } catch(e){}
      try { await db.query("ALTER TABLE reviews ADD COLUMN rider_rating TINYINT NULL"); changes.push('added rider_rating'); } catch(e){}
      try { await db.query("ALTER TABLE reviews ADD COLUMN rider_comment TEXT NULL"); changes.push('added rider_comment'); } catch(e){}
    } else {
      changes.push('rider columns already exist');
    }
    await db.query(`
      UPDATE shops s 
      SET rating = COALESCE(
        (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.shop_id = s.shop_id),
        s.rating,
        0.0
      )
    `);
    changes.push('recalculated all shop ratings');

    await db.query(`
      UPDATE riders r 
      SET rating = COALESCE(
        (SELECT ROUND(AVG(r2.rider_rating), 1) FROM reviews r2 WHERE r2.rider_id = r.rider_id AND r2.rider_rating IS NOT NULL),
        r.rating,
        5.0
      )
    `);
    changes.push('recalculated all rider ratings');

    res.json({ success: true, message: 'Rating system migration completed successfully', changes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware to globally fix relative image paths in API responses
app.use((req, res, next) => {
  const originalJson = res.json;
  const baseUrl = 'https://smartdeal-backend-vhjo.onrender.com';
  
  const fixUrls = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(fixUrls);
    const newObj = { ...obj };
    for (const key in newObj) {
      const val = newObj[key];
      if (typeof val === 'string') {
        if (val.length > 500 || val.startsWith('data:')) continue;
        if (key.includes('image') || key.includes('url') || key.includes('avatar') || key.includes('qr') || key.includes('slip')) {
          if (val.startsWith('/uploads')) {
            newObj[key] = baseUrl + val;
          } else if (val.startsWith('http://') && (val.includes(':5000/uploads') || val.includes('localhost'))) {
            newObj[key] = val.replace(/^http:\/\/[^/]+/, baseUrl);
          }
        }
      } else if (typeof val === 'object' && val !== null) {
        newObj[key] = fixUrls(val);
      }
    }
    return newObj;
  };

  res.json = function (data) {
    arguments[0] = fixUrls(data);
    return originalJson.apply(this, arguments);
  };
  next();
});

app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads/'))
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname || '.jpg'))
  }
});

const upload = multer({ storage: storage });

// ==========================================
// 🚀 HIGH-PERFORMANCE IN-MEMORY CACHE (Speed Booster)
// ==========================================
const cacheStore = new Map();

const getCache = (key) => {
  const item = cacheStore.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return item.data;
};

const setCache = (key, data, ttlSeconds = 45) => {
  cacheStore.set(key, {
    data,
    expiresAt: Date.now() + (ttlSeconds * 1000)
  });
};

const clearCache = (prefix = '') => {
  if (!prefix) {
    cacheStore.clear();
    return;
  }
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
};

// Health Check Endpoint (Keep-Alive)
app.get(['/health', '/api/health'], (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: Math.round(process.uptime()), 
    timestamp: new Date().toISOString() 
  });
});

// === BASE64 IMAGE SUPPORT ===
const initBase64ImageSupport = async () => {
  try {
    console.log('Altering tables for LONGTEXT images...');
    await db.execute('ALTER TABLE products MODIFY image_url LONGTEXT');
    await db.execute('ALTER TABLE shops MODIFY image_url LONGTEXT');
    await db.execute('ALTER TABLE auctions MODIFY image_url LONGTEXT');
    await db.execute('ALTER TABLE users MODIFY avatar_url LONGTEXT');
    await db.execute('ALTER TABLE banners MODIFY image_url LONGTEXT');
    await db.execute('ALTER TABLE complaints MODIFY image_url LONGTEXT');
    try { await db.execute('ALTER TABLE complaints ADD COLUMN order_id INT NULL AFTER user_id'); } catch (e) {}
    try { await db.execute('ALTER TABLE shops ADD COLUMN is_open TINYINT(1) NOT NULL DEFAULT 1'); } catch (e) {}

    console.log('✅ Tables altered for LONGTEXT images and is_open column successfully.');
  } catch (err) {
    console.error('❌ Error altering tables for LONGTEXT:', err.message);
  }
};
initBase64ImageSupport();

// 0. DATABASE INITIALIZATION
// ==========================================
const initNotificationsTable = async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'general',
        reference_id INT DEFAULT NULL,
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

  } catch (err) {
    console.error('❌ ไม่สามารถสร้างตาราง notifications ได้:', err.message);
  }
};
const initAddressesTable = async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_addresses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255),
        address_detail TEXT,
        latitude DECIMAL(10, 8) DEFAULT 16.246826,
        longitude DECIMAL(11, 8) DEFAULT 103.251992,
        receiver_name VARCHAR(255),
        receiver_phone VARCHAR(50),
        note_for_rider TEXT,
        is_default TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

  } catch (err) {
    console.error('❌ ไม่สามารถสร้างตาราง user_addresses ได้:', err.message);
  }
};
initAddressesTable();

const initPushTokenColumn = async () => {
  try {
    const [rows] = await db.query("SHOW COLUMNS FROM users LIKE 'push_token'");
    if (rows.length === 0) {
      await db.execute("ALTER TABLE users ADD COLUMN push_token VARCHAR(255) NULL");
      console.log('✅ Added push_token column to users table');
    }
  } catch (err) {
    console.error('❌ Error adding push_token column:', err.message);
  }
};
initPushTokenColumn();


const initOrderMessagesTable = async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS order_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        sender_id INT NOT NULL,
        sender_type ENUM('buyer', 'seller') NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('❌ ไม่สามารถสร้างตาราง order_messages ได้:', err.message);
  }
};
initOrderMessagesTable();

// Initialize & update order_messages and deliveries columns
const initExtendedChatAndProofTables = async () => {
  try {
    // 1. order_messages table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS order_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        sender_id INT NOT NULL,
        sender_type VARCHAR(50) NOT NULL,
        receiver_type VARCHAR(50) DEFAULT 'all',
        message TEXT NULL,
        image_url LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    try { await db.execute('ALTER TABLE order_messages MODIFY sender_type VARCHAR(50)'); } catch(e) {}
    try { await db.execute('ALTER TABLE order_messages ADD COLUMN receiver_type VARCHAR(50) DEFAULT "all"'); } catch(e) {}
    try { await db.execute('ALTER TABLE order_messages ADD COLUMN image_url LONGTEXT NULL'); } catch(e) {}

    // 2. deliveries table proof columns
    try { await db.execute('ALTER TABLE deliveries ADD COLUMN pickup_proof_image LONGTEXT NULL'); } catch(e) {}
    try { await db.execute('ALTER TABLE deliveries ADD COLUMN pickup_proofs LONGTEXT NULL'); } catch(e) {}
    try { await db.execute('ALTER TABLE deliveries MODIFY proof_image LONGTEXT NULL'); } catch(e) {}
    try { await db.execute('ALTER TABLE deliveries ADD COLUMN pickup_at DATETIME NULL'); } catch(e) {}
    try { await db.execute('ALTER TABLE orders ADD COLUMN shop_statuses LONGTEXT NULL'); } catch(e) {}
    console.log('✅ Extended chat and proof tables initialized successfully');
  } catch (err) {
    console.error('Table init error:', err.message);
  }
};
initExtendedChatAndProofTables();


const initComplaintsTable = async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS complaints (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        order_id INT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        image_url VARCHAR(255),
        status ENUM('pending', 'in_progress', 'resolved') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('❌ Error creating complaints table:', err.message);
  }
};
initComplaintsTable();

const initBannersTable = async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS banners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        image_url VARCHAR(255) NOT NULL,
        link_url VARCHAR(255),
        title VARCHAR(255),
        subtitle VARCHAR(255),
        badge_text VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    const [rows] = await db.execute('SELECT COUNT(*) as count FROM banners');
    if (rows[0].count === 0) {
      await db.execute(`
        INSERT INTO banners (image_url, link_url, title, subtitle, badge_text, is_active) VALUES 
        ('https://images.unsplash.com/photo-1555244162-803834f70033?w=800', 'https://www.google.com', 'ประหยัดสูงสุด 70% กับอาหารสดส่วนเกิน!', 'ช่วยลดขยะอาหารและเพลิดเพลินกับอาหารพรีเมียมในราคาสุดคุ้ม', 'ดีลสายฟ้าแลบ', true),
        ('https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800', 'https://www.google.com', 'ลดกระหน่ำมื้อค่ำ 50%', 'อาหารอร่อยจากร้านดังใกล้คุณ ลดราคาสุดพิเศษ', 'Flash Sale', true)
      `);
    }
  } catch (err) {
    console.error('❌ ไม่สามารถสร้างตาราง banners ได้:', err.message);
  }
};
initBannersTable();

const initPointsHistoryTable = async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_point_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        points_change VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('❌ Error creating user_point_history table:', err.message);
  }
};
initPointsHistoryTable();


// ==========================================
// 1. AUTHENTICATION APIs
// ==========================================

// เข้าสู่ระบบ (Email / Phone)
app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body;

  try {
    const [users] = await db.execute(
      'SELECT * FROM users WHERE email = ? OR phone = ?',
      [identifier, identifier]
    );

    if (users.length === 0) {
      return res.status(400).json({ message: 'ไม่พบอีเมลหรือเบอร์โทรศัพท์นี้ในระบบ' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash) || password === user.password_hash;
    
    if (!isMatch) {
      return res.status(400).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    // Check if this user is a seller (has an approved shop)
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
    console.error('Login Error:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ', error: error.message });
  }
});

// สมัครสมาชิก (ขอ OTP)
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

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'astotisuss@gmail.com',
        to: email,
        subject: 'รหัส OTP สำหรับยืนยันการสมัครสมาชิก - Smart Deal',
        html: `<h3>รหัส OTP ยืนยันอีเมลของคุณคือ: <b style="color: #2e7a32; font-size: 24px;">${otp}</b></h3><p>รหัสนี้จะหมดอายุภายใน 5 นาที</p>`
      });
      res.json({ message: 'ส่งรหัส OTP ไปยังอีเมลเรียบร้อยแล้ว' });
    } catch (err) {
      console.log('ส่งอีเมลไม่สำเร็จ:', err.message);
      // delete removed
        return res.status(200).json({ message: 'เซิร์ฟเวอร์ส่งอีเมลไม่ได้ชั่วคราว แต่สามารถใช้รหัสนี้ได้: ' + otp, otpFallback: otp });
    }
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

// ==========================================
// 1.05 POINTS REDEMPTION & COUPONS APIs
// ==========================================

// แลกของรางวัล / คูปองด้วยคะแนนสะสม (POST /api/points/redeem)
app.post('/api/points/redeem', async (req, res) => {
  const { user_id, cost, code, title, type, value } = req.body;
  if (!user_id || !cost) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุ user_id และจำนวนคะแนน' });
  }

  try {
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS user_coupons (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          code VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          value DECIMAL(10,2) NOT NULL,
          is_used TINYINT(1) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch(e) {}

    const [rows] = await db.execute('SELECT points FROM user_points WHERE user_id = ?', [user_id]);
    let currentPoints = rows.length > 0 ? parseInt(rows[0].points, 10) : 1000;
    
    if (currentPoints < cost) {
      return res.status(400).json({ success: false, message: 'คะแนนสะสมของคุณไม่เพียงพอ' });
    }

    const newPoints = currentPoints - cost;
    await db.execute('UPDATE user_points SET points = ? WHERE user_id = ?', [newPoints, user_id]);
    await db.execute(
      'INSERT INTO user_point_history (user_id, title, points_change) VALUES (?, ?, ?)',
      [user_id, `แลก ${title || 'ของรางวัล'}`, `-${cost}`]
    );

    const [insertCoupon] = await db.execute(
      'INSERT INTO user_coupons (user_id, code, title, type, value, is_used) VALUES (?, ?, ?, ?, ?, 0)',
      [user_id, code || 'DISCOUNT50', title || 'ส่วนลด 50 บาท', type || 'discount', value || 50]
    );

    res.json({
      success: true,
      message: `แลกรับ ${title} สำเร็จ!`,
      points: newPoints,
      coupon: {
        id: insertCoupon.insertId,
        code: code || 'DISCOUNT50',
        title: title || 'ส่วนลด 50 บาท',
        type: type || 'discount',
        value: value || 50
      }
    });
  } catch (error) {
    console.error('❌ POST /api/points/redeem error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ดึงคูปองของผู้ใช้ที่ยังไม่ได้ใช้งาน (GET /api/coupons/:userId)
app.get('/api/coupons/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS user_coupons (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          code VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          value DECIMAL(10,2) NOT NULL,
          is_used TINYINT(1) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch(e) {}

    const [coupons] = await db.execute(
      'SELECT id, code, title, type, value, created_at FROM user_coupons WHERE user_id = ? AND is_used = 0 ORDER BY created_at DESC',
      [userId]
    );
    res.json({ success: true, coupons });
  } catch (error) {
    console.error(`❌ GET /api/coupons/${userId} error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 1.1 USER PROFILE & ACCOUNT APIs
// ==========================================

// ดึงข้อมูลโปรไฟล์ผู้ใช้ (GET /api/users/:id หรือ GET /api/users/:id/profile)
app.get('/api/users/:id/profile', async (req, res) => {
  const { id } = req.params;
  try {
    const [users] = await db.execute(
      'SELECT user_id, full_name, email, phone, avatar_url, role, status, created_at, is_2fa_enabled FROM users WHERE user_id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้งาน' });
    }

    res.json({
      success: true,
      user: users[0]
    });
  } catch (error) {
    console.error(`❌ GET /api/users/${id}/profile error:`, error.message);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์', error: error.message });
  }
});

// ดึงข้อมูลผู้ใช้ทั่วไป (GET /api/users/:id)
app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [users] = await db.execute(
      'SELECT user_id, full_name, email, phone, avatar_url, role, status, created_at, is_2fa_enabled FROM users WHERE user_id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้งาน' });
    }

    res.json({
      success: true,
      user: users[0]
    });
  } catch (error) {
    console.error(`❌ GET /api/users/${id} error:`, error.message);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งาน', error: error.message });
  }
});

// อัปเดตข้อมูลโปรไฟล์ (PUT /api/users/:id/profile หรือ PUT /api/users/:id)
app.put('/api/users/:id/profile', async (req, res) => {
  const { id } = req.params;
  const { full_name, phone, email, avatar_url, profile_image } = req.body;
  const finalAvatar = avatar_url !== undefined ? avatar_url : profile_image;

  try {
    // 1. ตรวจสอบว่าผู้ใช้มีอยู่จริงหรือไม่
    const [existingUser] = await db.execute('SELECT * FROM users WHERE user_id = ?', [id]);
    if (existingUser.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' });
    }

    const current = existingUser[0];
    const newFullName = full_name !== undefined ? full_name : current.full_name;
    const newPhone = phone !== undefined ? phone : current.phone;
    const newEmail = email !== undefined ? email : current.email;
    const newAvatar = finalAvatar !== undefined ? finalAvatar : current.avatar_url;

    // 2. ตรวจสอบว่า email หรือ phone ซ้ำกับ user อื่นหรือไม่
    if (newEmail || newPhone) {
      const [duplicate] = await db.execute(
        'SELECT user_id FROM users WHERE (email = ? OR phone = ?) AND user_id != ?',
        [newEmail, newPhone, id]
      );
      if (duplicate.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'อีเมลหรือเบอร์โทรศัพท์นี้ถูกใช้งานโดยบัญชีอื่นแล้ว กรุณาใช้อีเมล/เบอร์โทรศัพท์อื่น' 
        });
      }
    }

    // 3. ทำการอัปเดตลงตาราง users ในฐานข้อมูล MySQL
    await db.execute(
      'UPDATE users SET full_name = ?, phone = ?, email = ?, avatar_url = ? WHERE user_id = ?',
      [newFullName, newPhone, newEmail, newAvatar, id]
    );

    // 4. ดึงข้อมูลล่าสุดที่อัปเดตแล้วส่งกลับไปให้ Frontend
    const [updatedRows] = await db.execute(
      'SELECT user_id, full_name, email, phone, avatar_url, role, status FROM users WHERE user_id = ?',
      [id]
    );

    const updatedUser = updatedRows[0];
    console.log(`✅ อัปเดตข้อมูลผู้ใช้ ID: ${id} สำเร็จ:`, updatedUser);

    res.json({
      success: true,
      message: 'บันทึกข้อมูลส่วนตัวสำเร็จ',
      user: updatedUser
    });
  } catch (error) {
    console.error(`❌ PUT /api/users/${id}/profile error:`, error.message);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', error: error.message });
  }
});

// อัปโหลดรูปโปรไฟล์ (POST /api/users/:id/avatar)
app.post('/api/users/:id/avatar', upload.single('avatar'), async (req, res) => {
  const { id } = req.params;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'ไม่มีไฟล์' });
    }
    const avatarUrl = '/uploads/' + req.file.filename;
    await db.execute('UPDATE users SET avatar_url = ? WHERE user_id = ?', [avatarUrl, id]);
    res.json({ success: true, avatar_url: avatarUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// เปลี่ยนรหัสผ่าน (PUT /api/users/:id/change-password)
app.put('/api/users/:id/change-password', async (req, res) => {
  const { id } = req.params;
  const { old_password, new_password, oldPassword, newPassword } = req.body;
  const currentPassword = old_password || oldPassword;
  const targetPassword = new_password || newPassword;

  if (!currentPassword || !targetPassword) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกรหัสผ่านเดิมและรหัสผ่านใหม่' });
  }

  if (targetPassword.length < 4) {
    return res.status(400).json({ success: false, message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร' });
  }

  try {
    const [users] = await db.execute('SELECT * FROM users WHERE user_id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    }

    const salt = await bcrypt.genSalt(10);
    const new_password_hash = await bcrypt.hash(targetPassword, salt);

    await db.execute('UPDATE users SET password_hash = ? WHERE user_id = ?', [new_password_hash, id]);
    console.log(`✅ เปลี่ยนรหัสผ่านของผู้ใช้ ID: ${id} สำเร็จ`);

    res.json({
      success: true,
      message: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว'
    });
  } catch (error) {
    console.error(`❌ PUT /api/users/${id}/change-password error:`, error.message);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน', error: error.message });
  }
});

// ดึงคะแนนพอยท์และประวัติ (GET /api/points/:userId)
app.get('/api/points/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await db.execute('SELECT * FROM user_points WHERE user_id = ?', [userId]);
    let points = 1000;
    
    if (rows.length === 0) {
      await db.execute('INSERT IGNORE INTO user_points (user_id, points) VALUES (?, 1000)', [userId]);
      await db.execute('INSERT IGNORE INTO user_point_history (user_id, title, points_change) VALUES (?, ?, ?)', [userId, 'โบนัสต้อนรับสมาชิกใหม่', '+1000']);
    } else {
      points = rows[0].points;
    }

    const [historyRows] = await db.execute('SELECT * FROM user_point_history WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    
    const formattedHistory = historyRows.map(h => ({
      id: h.id.toString(),
      title: h.title,
      points: h.points_change,
      date: new Date(h.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
    }));

    res.json({
      success: true,
      points: points,
      history: formattedHistory
    });
  } catch (error) {
    console.error(`❌ GET /api/points/${userId} error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 1.1 USER PROFILE & ACCOUNT APIs
// ==========================================

// ดึงข้อมูลโปรไฟล์ผู้ใช้ (GET /api/users/:id หรือ GET /api/users/:id/profile)
app.get('/api/users/:id/profile', async (req, res) => {
  const { id } = req.params;
  try {
    const [users] = await db.execute(
      'SELECT user_id, full_name, email, phone, avatar_url, role, status, created_at, is_2fa_enabled FROM users WHERE user_id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้งาน' });
    }

    res.json({
      success: true,
      user: users[0]
    });
  } catch (error) {
    console.error(`❌ GET /api/users/${id}/profile error:`, error.message);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์', error: error.message });
  }
});

// ดึงข้อมูลผู้ใช้ทั่วไป (GET /api/users/:id)
app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [users] = await db.execute(
      'SELECT user_id, full_name, email, phone, avatar_url, role, status, created_at, is_2fa_enabled FROM users WHERE user_id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้งาน' });
    }

    res.json({
      success: true,
      user: users[0]
    });
  } catch (error) {
    console.error(`❌ GET /api/users/${id} error:`, error.message);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้งาน', error: error.message });
  }
});

// อัปเดตข้อมูลโปรไฟล์ (PUT /api/users/:id/profile หรือ PUT /api/users/:id)
app.put('/api/users/:id/profile', async (req, res) => {
  const { id } = req.params;
  const { full_name, phone, email, avatar_url, profile_image } = req.body;
  const finalAvatar = avatar_url !== undefined ? avatar_url : profile_image;

  try {
    // 1. ตรวจสอบว่าผู้ใช้มีอยู่จริงหรือไม่
    const [existingUser] = await db.execute('SELECT * FROM users WHERE user_id = ?', [id]);
    if (existingUser.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' });
    }

    const current = existingUser[0];
    const newFullName = full_name !== undefined ? full_name : current.full_name;
    const newPhone = phone !== undefined ? phone : current.phone;
    const newEmail = email !== undefined ? email : current.email;
    const newAvatar = finalAvatar !== undefined ? finalAvatar : current.avatar_url;

    // 2. ตรวจสอบว่า email หรือ phone ซ้ำกับ user อื่นหรือไม่
    if (newEmail || newPhone) {
      const [duplicate] = await db.execute(
        'SELECT user_id FROM users WHERE (email = ? OR phone = ?) AND user_id != ?',
        [newEmail, newPhone, id]
      );
      if (duplicate.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'อีเมลหรือเบอร์โทรศัพท์นี้ถูกใช้งานโดยบัญชีอื่นแล้ว กรุณาใช้อีเมล/เบอร์โทรศัพท์อื่น' 
        });
      }
    }

    // 3. ทำการอัปเดตลงตาราง users ในฐานข้อมูล MySQL
    await db.execute(
      'UPDATE users SET full_name = ?, phone = ?, email = ?, avatar_url = ? WHERE user_id = ?',
      [newFullName, newPhone, newEmail, newAvatar, id]
    );

    // 4. ดึงข้อมูลล่าสุดที่อัปเดตแล้วส่งกลับไปให้ Frontend
    const [updatedRows] = await db.execute(
      'SELECT user_id, full_name, email, phone, avatar_url, role, status FROM users WHERE user_id = ?',
      [id]
    );

    const updatedUser = updatedRows[0];
    console.log(`✅ อัปเดตข้อมูลผู้ใช้ ID: ${id} สำเร็จ:`, updatedUser);

    res.json({
      success: true,
      message: 'บันทึกข้อมูลส่วนตัวสำเร็จ',
      user: updatedUser
    });
  } catch (error) {
    console.error(`❌ PUT /api/users/${id}/profile error:`, error.message);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', error: error.message });
  }
});

// อัปโหลดรูปโปรไฟล์ (POST /api/users/:id/avatar)
app.post('/api/users/:id/avatar', upload.single('avatar'), async (req, res) => {
  const { id } = req.params;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'ไม่มีไฟล์' });
    }
    const avatarUrl = '/uploads/' + req.file.filename;
    await db.execute('UPDATE users SET avatar_url = ? WHERE user_id = ?', [avatarUrl, id]);
    res.json({ success: true, avatar_url: avatarUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// เปลี่ยนรหัสผ่าน (PUT /api/users/:id/change-password)
app.put('/api/users/:id/change-password', async (req, res) => {
  const { id } = req.params;
  const { old_password, new_password, oldPassword, newPassword } = req.body;
  const currentPassword = old_password || oldPassword;
  const targetPassword = new_password || newPassword;

  if (!currentPassword || !targetPassword) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกรหัสผ่านเดิมและรหัสผ่านใหม่' });
  }

  if (targetPassword.length < 4) {
    return res.status(400).json({ success: false, message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร' });
  }

  try {
    const [users] = await db.execute('SELECT * FROM users WHERE user_id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    }

    const salt = await bcrypt.genSalt(10);
    const new_password_hash = await bcrypt.hash(targetPassword, salt);

    await db.execute('UPDATE users SET password_hash = ? WHERE user_id = ?', [new_password_hash, id]);
    console.log(`✅ เปลี่ยนรหัสผ่านของผู้ใช้ ID: ${id} สำเร็จ`);

    res.json({
      success: true,
      message: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว'
    });
  } catch (error) {
    console.error(`❌ PUT /api/users/${id}/change-password error:`, error.message);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน', error: error.message });
  }
});

// ดึงคะแนนพอยท์และประวัติ (GET /api/points/:userId)
app.get('/api/points/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await db.execute('SELECT * FROM user_points WHERE user_id = ?', [userId]);
    let points = 1000;
    
    if (rows.length === 0) {
      await db.execute('INSERT IGNORE INTO user_points (user_id, points) VALUES (?, 1000)', [userId]);
      await db.execute('INSERT IGNORE INTO user_point_history (user_id, title, points_change) VALUES (?, ?, ?)', [userId, 'โบนัสต้อนรับสมาชิกใหม่', '+1000']);
    } else {
      points = rows[0].points;
    }

    const [historyRows] = await db.execute('SELECT * FROM user_point_history WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    
    const formattedHistory = historyRows.map(h => ({
      id: h.id.toString(),
      title: h.title,
      points: h.points_change,
      date: new Date(h.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
    }));

    res.json({
      success: true,
      points: points,
      history: formattedHistory
    });
  } catch (error) {
    console.error(`❌ GET /api/points/${userId} error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. OTP & PASSWORD RESET APIs
// ==========================================


app.post('/api/forgot-password/request-otp', async (req, res) => {
  const { email } = req.body;
  try {
    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'ไม่พบอีเมลนี้ในระบบ' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    otpStore[email] = { otp, expiresAt };
    console.log(`[OTP DEBUG] รหัส OTP ของ ${email} คือ: ${otp}`);

    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'astotisuss@gmail.com',
      to: email,
      subject: 'รหัส OTP สำหรับตั้งรหัสผ่านใหม่ - Smart Deal',
      html: `<h3>รหัส OTP ยืนยันตัวตนของคุณคือ: <b style="color: #2e7a32; font-size: 24px;">${otp}</b></h3><p>รหัสนี้จะหมดอายุภายใน 5 นาที</p>`
    }).catch(err => {
      console.log('ส่งอีเมลไม่สำเร็จ:', err.message);
      // Let it pass silently, or we can just let it continue to the res.json below
    });

    res.json({ message: 'ส่งรหัส OTP เรียบร้อยแล้ว (ถ้าระบบอีเมลขัดข้อง สามารถใช้รหัส: ' + otp + ' ได้เลย)', otpFallback: otp });
  } catch (error) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาดทางเซิร์ฟเวอร์', error: error.message });
  }
});

app.post('/api/forgot-password/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore[email];

  if (!record) return res.status(400).json({ message: 'กรุณาขอรหัส OTP ใหม่' });
  if (Date.now() > record.expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ message: 'รหัส OTP หมดอายุแล้ว' });
  }
  if (record.otp !== otp) {
    return res.status(400).json({ message: 'รหัส OTP ไม่ถูกต้อง' });
  }

  res.json({ message: 'ยืนยันรหัส OTP ถูกต้อง' });
});

app.post('/api/forgot-password/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const record = otpStore[email];

  if (!record || record.otp !== otp) {
    return res.status(400).json({ message: 'สิทธิ์การเปลี่ยนรหัสผ่านไม่ถูกต้อง หรือ OTP หมดอายุ' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password_hash = ? WHERE email = ?', [hashedPassword, email]);
    delete otpStore[email];

    res.json({ message: 'ตั้งรหัสผ่านใหม่สำเร็จแล้ว' });
  } catch (error) {
    res.status(500).json({ message: 'บันทึกรหัสผ่านใหม่ไม่สำเร็จ' });
  }
});

// ==========================================
// 3. HOME & PRODUCTS APIs
// ==========================================

app.get('/api/home-data', async (req, res) => {
  try {
    // 1. ตรวจสอบ In-Memory Cache (ความเร็ว 5ms แทน 2000ms)
    const cachedData = getCache('home-data');
    if (cachedData) {
      return res.json(cachedData);
    }

    const [categories] = await db.execute('SELECT * FROM categories');
    
    // Get products with shop open status
    const [products] = await db.execute(`
      SELECT 
        p.*,
        s.name AS shop_name,
        s.image_url AS shop_image,
        IFNULL(s.is_open, 1) AS is_open
      FROM products p
      LEFT JOIN shops s ON p.shop_id = s.shop_id
      WHERE p.stock_quantity > 0 AND p.is_auction = 0 AND (s.is_open IS NULL OR s.is_open = 1) AND (p.deal_end_time > UTC_TIMESTAMP() OR p.deal_end_time IS NULL)
      ORDER BY p.deal_end_time IS NULL ASC, p.deal_end_time ASC
    `);
    
    const [shops] = await db.execute('SELECT *, IFNULL(is_open, 1) AS is_open FROM shops');

    // Filter deals and shops based on is_open (1 = open, 0 = closed) and deal expiry
    const deals = products
      .filter(p => {
        const isOpen = p.is_open === 1 || p.is_open === true || p.is_open == '1' || p.is_open === null || p.is_open === undefined;
        if (!isOpen) return false;
        const rawExpires = p.deal_end_time || p.expiry_time || p.expires_at || p.end_time || p.pickup_end_time;
        if (rawExpires) {
          const expTime = new Date(rawExpires).getTime();
          if (!isNaN(expTime) && expTime <= Date.now()) return false;
        }
        return true;
      })
      .map(p => {
        const rawExpires = p.deal_end_time || p.expiry_time || p.expires_at || p.end_time || p.pickup_end_time;
        const formattedExpiresAt = rawExpires ? new Date(rawExpires).toISOString() : null;

        const origPrice = parseFloat(p.original_price ?? p.price ?? 0);
        const discPrice = parseFloat(p.discount_price ?? p.price ?? 0);
        const stockQty = parseInt(p.stock_quantity !== undefined && p.stock_quantity !== null ? p.stock_quantity : 5, 10);

        return {
          ...p,
          price: discPrice,
          original_price: origPrice,
          discount_price: discPrice,
          stock_quantity: stockQty,
          deal_end_time: formattedExpiresAt,
          expires_at: formattedExpiresAt,
          shop_name: p.shop_name || 'ร้านค้าพรีเมียม',
          shop_image: p.shop_image || ''
        };
      });

    const formattedShops = shops
      .filter(s => s.is_open === 1 || s.is_open === true || s.is_open == '1' || s.is_open === null || s.is_open === undefined)
      .map(s => ({
        ...s,
        name: s.name || s.shop_name || ''
      }));

    const responsePayload = {
      success: true,
      categories,
      deals,
      shops: formattedShops
    };

    // เก็บลง Cache นาน 45 วินาที
    setCache('home-data', responsePayload, 45);

    res.json(responsePayload);

  } catch (err) {
    console.error('❌ Error (/api/home-data):', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        p.*,
        s.name AS shop_name,
        s.image_url AS shop_image,
        IFNULL(s.is_open, 1) AS is_open
      FROM products p
      LEFT JOIN shops s ON p.shop_id = s.shop_id
      WHERE p.stock_quantity > 0 AND (s.is_open IS NULL OR s.is_open = 1) AND (p.deal_end_time > UTC_TIMESTAMP() OR p.deal_end_time IS NULL)
      ORDER BY p.deal_end_time IS NULL ASC, p.deal_end_time ASC
    `);

    const formattedProducts = rows
      .filter(p => {
        const rawExpires = p.deal_end_time || p.expiry_time || p.expires_at || p.end_time || p.pickup_end_time;
        if (rawExpires) {
          const expTime = new Date(rawExpires).getTime();
          if (!isNaN(expTime) && expTime <= Date.now()) return false;
        }
        return true;
      })
      .map(p => {
      const rawExpires = p.deal_end_time || p.expiry_time || p.expires_at || p.end_time || p.pickup_end_time;
      const formattedExpiresAt = rawExpires ? new Date(rawExpires).toISOString() : null;

      const origPrice = parseFloat(p.original_price ?? p.price ?? 0);
      const discPrice = parseFloat(p.discount_price ?? p.price ?? 0);
      const stockQty = parseInt(p.stock_quantity !== undefined && p.stock_quantity !== null ? p.stock_quantity : 5, 10);

      return {
        ...p,
        price: discPrice,
        original_price: origPrice,
        discount_price: discPrice,
        stock_quantity: stockQty,
        deal_end_time: formattedExpiresAt,
        expires_at: formattedExpiresAt,
        shop_name: p.shop_name || 'ร้านค้าพรีเมียม',
        shop_image: p.shop_image || ''
      };
    });

    res.json({ success: true, products: formattedProducts });
  } catch (err) {
    console.error('❌ SQL Error (/api/products):', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute('SELECT * FROM products WHERE product_id = ? AND stock_quantity > 0', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบสินค้า' });
    }

    const product = rows[0];

    let shopName = 'ร้านค้าพรีเมียม';
    let shopImage = null;
    let shopAddress = null;
    let shopRating = null;

    if (product.shop_id) {
      const [shops] = await db.execute('SELECT * FROM shops WHERE shop_id = ?', [product.shop_id]);
      if (shops.length > 0) {
        shopName = shops[0].name || shops[0].shop_name || 'ร้านค้าพรีเมียม';
        shopImage = shops[0].image_url;
        shopAddress = shops[0].address;
        shopRating = shops[0].rating;
      }
    }

    const rawExpires = product.deal_end_time || product.expires_at || product.end_time || product.pickup_end_time;
    const formattedExpiresAt = rawExpires ? new Date(rawExpires).toISOString() : null;
    const origPrice = parseFloat(product.original_price ?? product.price ?? 0);
    const discPrice = parseFloat(product.discount_price ?? product.price ?? 0);
    const stockQty = parseInt(product.stock_quantity !== undefined && product.stock_quantity !== null ? product.stock_quantity : 0, 10);

    const finalProduct = {
      ...product,
      price: discPrice,
      original_price: origPrice,
      discount_price: discPrice,
      stock_quantity: stockQty,
      expires_at: formattedExpiresAt,
      deal_end_time: formattedExpiresAt,
      shop_name: shopName,
      shop_image: shopImage,
      shop_address: shopAddress,
      shop_rating: shopRating
    };

    res.json({ success: true, product: finalProduct });

  } catch (err) {
    console.error(`❌ Error on /api/products/${id}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. ADDRESS APIs
// ==========================================

// ดึงข้อมูลที่อยู่เริ่มต้น/ล่าสุดของ User (GET)
app.get('/api/users/:id/address', async (req, res) => {
  const userId = req.params.id;
  try {
    const [rows] = await db.execute(
      'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, updated_at DESC LIMIT 1',
      [userId]
    );

    if (rows && rows.length > 0) {
      const a = rows[0];
      res.json({
        success: true,
        id: a.id,
        address_id: a.id,
        user_id: a.user_id,
        title: a.title || 'ที่อยู่จัดส่ง',
        address_detail: a.address_detail || '',
        latitude: a.latitude ? parseFloat(a.latitude) : 16.246826,
        longitude: a.longitude ? parseFloat(a.longitude) : 103.251992,
        receiver_name: a.receiver_name || '',
        receiver_phone: a.receiver_phone || '',
        note_for_rider: a.note_for_rider || '',
        is_default: Boolean(a.is_default),
        created_at: a.created_at,
        updated_at: a.updated_at
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('❌ GET Address Error:', error.message);
    res.status(500).json({ success: false, message: 'Database error', error: error.message });
  }
});

// ดึงรายการที่อยู่ทั้งหมดของ User (GET)
app.get('/api/users/:id/addresses', async (req, res) => {
  const userId = req.params.id;
  try {
    const [rows] = await db.execute(
      'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, updated_at DESC',
      [userId]
    );

    res.json({
      success: true,
      addresses: rows.map(a => ({
        id: a.id,
        address_id: a.id,
        user_id: a.user_id,
        title: a.title,
        address_detail: a.address_detail,
        latitude: a.latitude ? parseFloat(a.latitude) : 16.246826,
        longitude: a.longitude ? parseFloat(a.longitude) : 103.251992,
        receiver_name: a.receiver_name,
        receiver_phone: a.receiver_phone,
        note_for_rider: a.note_for_rider,
        is_default: Boolean(a.is_default)
      }))
    });
  } catch (error) {
    console.error('❌ GET Addresses Error:', error.message);
    res.status(500).json({ success: false, message: 'Database error', error: error.message });
  }
});

// บันทึก/อัปเดตที่อยู่ของ User พร้อมพิกัดแผนที่ (POST)
app.post('/api/users/:id/address', async (req, res) => {
  const userId = req.params.id;
  const {
    title,
    address_detail,
    latitude,
    longitude,
    receiver_name,
    recipient_name,
    receiver_phone,
    phone_number,
    note_for_rider,
    is_default = 1
  } = req.body;

  const finalName = receiver_name || recipient_name || '';
  const finalPhone = receiver_phone || phone_number || '';
  const finalLat = parseFloat(latitude) || 16.246826;
  const finalLng = parseFloat(longitude) || 103.251992;
  const finalTitle = title || 'ที่อยู่ของฉัน';
  const finalDetail = address_detail || '';
  const finalNote = note_for_rider || '';

  try {
    const [existing] = await db.execute('SELECT id FROM user_addresses WHERE user_id = ? LIMIT 1', [userId]);

    if (existing && existing.length > 0) {
      await db.execute(
        `UPDATE user_addresses 
         SET title = ?, address_detail = ?, latitude = ?, longitude = ?, receiver_name = ?, receiver_phone = ?, note_for_rider = ?, is_default = ?, updated_at = NOW() 
         WHERE user_id = ?`,
        [finalTitle, finalDetail, finalLat, finalLng, finalName, finalPhone, finalNote, is_default ? 1 : 0, userId]
      );
    } else {
      await db.execute(
        `INSERT INTO user_addresses (user_id, title, address_detail, latitude, longitude, receiver_name, receiver_phone, note_for_rider, is_default, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [userId, finalTitle, finalDetail, finalLat, finalLng, finalName, finalPhone, finalNote, is_default ? 1 : 0]
      );
    }

    const [updated] = await db.execute('SELECT * FROM user_addresses WHERE user_id = ? LIMIT 1', [userId]);
    const a = updated[0];

    console.log(`📍 บันทึกที่อยู่และพิกัดสำหรับ User ${userId}: ${finalTitle} (${finalLat}, ${finalLng})`);

    res.json({
      success: true,
      message: 'บันทึกที่อยู่จัดส่งและพิกัดแผนที่สำเร็จ',
      address: {
        id: a.id,
        address_id: a.id,
        user_id: a.user_id,
        title: a.title,
        address_detail: a.address_detail,
        latitude: parseFloat(a.latitude),
        longitude: parseFloat(a.longitude),
        receiver_name: a.receiver_name,
        receiver_phone: a.receiver_phone,
        note_for_rider: a.note_for_rider,
        is_default: Boolean(a.is_default)
      }
    });
  } catch (error) {
    console.error('❌ POST Address Error:', error.message);
    res.status(500).json({ success: false, message: 'Database error', error: error.message });
  }
});

// กำหนดที่อยู่หลัก (PUT)
app.put('/api/users/:userId/address/:addressId/default', async (req, res) => {
  const { userId, addressId } = req.params;
  try {
    await db.execute('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    await db.execute('UPDATE user_addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [addressId, userId]);
    res.json({ success: true, message: 'ตั้งเป็นที่อยู่หลักเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('❌ Set Default Address Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4.5 RIDER & TRACKING APIs
// ==========================================

// ดึงข้อมูล Tracking แบบ Real-time
app.get('/api/orders/:id/tracking', async (req, res) => {
  const orderId = req.params.id;
  try {
    const [orders] = await db.execute(`
      SELECT o.*, DATE_FORMAT(o.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at, 
             s.latitude as shop_lat, s.longitude as shop_lng, s.name as shop_name, s.address as shop_address,
             u_rider.full_name as rider_name, 
             u_rider.phone as rider_phone, 
             r.vehicle_plate, r.rating as rider_rating,
             r.current_lat as rider_lat, r.current_lng as rider_lng,
             del.status as delivery_status,
             del.pickup_proof_image,
             del.proof_image as delivery_proof_image,
             del.proof_image,
             del.pickup_at,
             del.completed_at as delivery_completed_at
      FROM orders o
      LEFT JOIN shops s ON o.shop_id = s.shop_id
      LEFT JOIN deliveries del ON o.order_id = del.order_id
      LEFT JOIN riders r ON (o.rider_id = r.rider_id OR del.rider_id = r.rider_id)
      LEFT JOIN users u_rider ON r.user_id = u_rider.user_id
      WHERE o.order_id = ?
    `, [orderId]);

    if (!orders || orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const o = orders[0];

    // Query all distinct shops involved in this order
    let shopsList = [];
    try {
      const [itemShops] = await db.query(`
        SELECT 
          s.shop_id, 
          s.name, 
          s.address, 
          COALESCE(s.image_url, MAX(item_shops.product_image)) AS image_url,
          s.latitude AS lat, 
          s.longitude AS lng,
          u.phone,
          u.user_id as owner_user_id
        FROM (
          SELECT 
            COALESCE(oi.shop_id, p.shop_id, o.shop_id) AS shop_id,
            COALESCE(p.image_url, (SELECT image_url FROM auctions WHERE title COLLATE utf8mb4_unicode_ci = oi.product_name COLLATE utf8mb4_unicode_ci LIMIT 1), '') AS product_image
          FROM orders o
          LEFT JOIN order_items oi ON o.order_id = oi.order_id
          LEFT JOIN products p ON oi.product_id = p.product_id
          WHERE o.order_id = ?
        ) item_shops
        JOIN shops s ON item_shops.shop_id = s.shop_id
        LEFT JOIN users u ON s.owner_id = u.user_id
        GROUP BY s.shop_id, s.name, s.address, s.image_url, s.latitude, s.longitude, u.phone, u.user_id
      `, [orderId]);

      let parsedShopStatuses = {};
      if (o.shop_statuses) {
        try { parsedShopStatuses = typeof o.shop_statuses === 'string' ? JSON.parse(o.shop_statuses) : o.shop_statuses; } catch(e) {}
      }
      let parsedPickupProofs = {};
      if (o.pickup_proofs) {
        try { parsedPickupProofs = typeof o.pickup_proofs === 'string' ? JSON.parse(o.pickup_proofs) : o.pickup_proofs; } catch(e) {}
      }

      if (itemShops && itemShops.length > 0) {
        shopsList = itemShops.map(s => {
          const sid = String(s.shop_id);
          const isPickedUp = !!(parsedPickupProofs[sid] && parsedPickupProofs[sid].proof_image);
          let sStatus = parsedShopStatuses[sid] || o.order_status;
          if (isPickedUp) sStatus = 'picked_up';

          if (['delivered', 'completed', 'cancelled'].includes(o.order_status)) {
            sStatus = o.order_status;
          } else if (['delivering', 'shipped'].includes(o.order_status)) {
            sStatus = isPickedUp ? 'picked_up' : 'delivering';
          }

          return {
            shop_id: s.shop_id,
            name: s.name,
            address: s.address,
            image_url: s.image_url,
            phone: s.phone,
            owner_user_id: s.owner_user_id,
            lat: s.lat ? parseFloat(s.lat) : null,
            lng: s.lng ? parseFloat(s.lng) : null,
            status: sStatus,
            is_picked_up: isPickedUp,
            pickup_proof_image: parsedPickupProofs[sid]?.proof_image || null
          };
        });
      }
    } catch (sErr) {
      console.error('Error fetching order shops for tracking:', sErr.message);
    }

    if (shopsList.length === 0) {
      shopsList = [{
        shop_id: o.shop_id || 1,
        name: o.shop_name || 'ร้านค้า',
        address: o.shop_address || '',
        image_url: null,
        phone: null,
        owner_user_id: null,
        lat: o.shop_lat ? parseFloat(o.shop_lat) : null,
        lng: o.shop_lng ? parseFloat(o.shop_lng) : null,
        status: o.order_status,
        is_picked_up: false,
        pickup_proof_image: null
      }];
    }

    res.json({
      success: true,
      order: {
        order_id: o.order_id,
        status: o.order_status,
        delivery_status: o.delivery_status,
        created_at: o.created_at,
        prepared_at: o.prepared_at,
        picked_up_at: o.picked_up_at || o.pickup_at,
        pickup_at: o.pickup_at || o.picked_up_at,
        delivered_at: o.delivered_at || o.delivery_completed_at,
        pickup_proof_image: o.pickup_proof_image,
        proof_image: o.proof_image || o.delivery_proof_image,
        delivery_proof_image: o.delivery_proof_image || o.proof_image,
        delivery_lat: o.delivery_lat ? parseFloat(o.delivery_lat) : null,
        delivery_lng: o.delivery_lng ? parseFloat(o.delivery_lng) : null,
        shipping_address: o.shipping_address,
        receiver_name: o.receiver_name,
        receiver_phone: o.receiver_phone,
        note_for_rider: o.note_for_rider
      },
      shop: shopsList[0],
      shops: shopsList,
      rider: o.rider_name ? {
        name: o.rider_name,
        phone: o.rider_phone,
        vehicle_plate: o.vehicle_plate,
        rating: o.rider_rating,
        lat: o.rider_lat ? parseFloat(o.rider_lat) : null,
        lng: o.rider_lng ? parseFloat(o.rider_lng) : null
      } : null
    });
  } catch (error) {
    console.error('❌ GET Tracking Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// อัปเดตพิกัดคนขับ
app.put('/api/riders/:id/location', async (req, res) => {
  const riderId = req.params.id;
  const { lat, lng } = req.body;
  try {
    await db.execute('UPDATE riders SET current_lat = ?, current_lng = ?, updated_at = NOW() WHERE rider_id = ?', [lat, lng, riderId]);
    res.json({ success: true, message: 'Rider location updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 5. ORDERS APIs
// ==========================================

app.get('/api/orders/user/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId || userId === 'undefined' || userId === 'null') {
    return res.status(400).json({ success: false, message: 'ไม่พบรหัสผู้ใช้งาน' });
  }

  try {
    const sql = `
      SELECT orders.*, DATE_FORMAT(orders.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at, 
        shops.name AS shop_name,
        shops.image_url AS shop_image,
        del.status AS delivery_status,
        del.pickup_proof_image,
        del.proof_image AS delivery_proof_image,
        del.proof_image,
        del.pickup_at,
        del.completed_at AS delivery_completed_at,
        u_rider.full_name AS rider_name,
        u_rider.phone AS rider_phone,
        r.vehicle_plate AS rider_vehicle_plate,
        u_customer.full_name AS customer_name,
        u_customer.phone AS customer_phone
      FROM orders
      LEFT JOIN shops ON orders.shop_id = shops.shop_id
      LEFT JOIN deliveries del ON orders.order_id = del.order_id
      LEFT JOIN riders r ON r.rider_id = COALESCE(del.rider_id, orders.rider_id)
      LEFT JOIN users u_rider ON r.user_id = u_rider.user_id
      LEFT JOIN users u_customer ON orders.user_id = u_customer.user_id
      WHERE orders.user_id = ?
      ORDER BY orders.created_at DESC
    `;

    const [orders] = await db.execute(sql, [userId]);

    if (orders.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const statusThai = {
      pending: 'กำลังดำเนินการ',
      paid: 'สำเร็จ',
      preparing: 'กำลังเตรียมอาหาร',
      ready: 'พร้อมส่ง',
      delivering: 'กำลังจัดส่ง',
      completed: 'สำเร็จ',
      cancelled: 'ยกเลิก'
    };

    const deliveryTypeThai = {
      delivery: 'จัดส่งถึงบ้าน',
      pickup: 'รับที่ร้าน'
    };

    // Auto self-heal mismatched order_items shop_id to match products table
    try {
      await db.query(`
        UPDATE order_items oi
        JOIN products p ON oi.product_id = p.product_id
        SET oi.shop_id = p.shop_id
        WHERE oi.product_id IS NOT NULL AND (oi.shop_id != p.shop_id OR oi.shop_id IS NULL)
      `);
    } catch(e) {}

    // Batch fetch all items in 1 single fast query
    const orderIds = orders.map(o => o.order_id);
    let itemsByOrderId = {};
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      let allItems = [];
      try {
        const [rows] = await db.query(
          `SELECT oi.*, p.name AS db_product_name, p.image_url AS product_image, p.shop_id AS product_shop_id,
                  COALESCE(s_p.name, s_oi.name, (SELECT name FROM shops WHERE shop_id = p.shop_id), (SELECT name FROM shops WHERE shop_id = oi.shop_id), '') AS item_shop_name
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id = p.product_id
           LEFT JOIN shops s_p ON p.shop_id = s_p.shop_id
           LEFT JOIN shops s_oi ON oi.shop_id = s_oi.shop_id
           WHERE oi.order_id IN (${placeholders})`,
          orderIds
        );
        allItems = rows || [];
      } catch (itemErr) {
        console.error('Error fetching order items:', itemErr.message);
      }
      allItems.forEach(item => {
        if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
        itemsByOrderId[item.order_id].push(item);
      });
    }

    const formattedOrders = orders.map((order) => {
      const items = itemsByOrderId[order.order_id] || [];
      const primaryItem = items && items.length > 0 ? items[0] : null;
      const displayTitle = primaryItem ? (primaryItem.product_name || primaryItem.db_product_name || order.shop_name) : (order.shop_name || 'ร้านค้า');
      const displayImage = (primaryItem && primaryItem.product_image) || order.shop_image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';

      // Parse shop_statuses & pickup_proofs
      let parsedShopStatuses = {};
      if (order.shop_statuses) {
        try { parsedShopStatuses = typeof order.shop_statuses === 'string' ? JSON.parse(order.shop_statuses) : order.shop_statuses; } catch(e) {}
      }
      let parsedPickupProofs = {};
      if (order.pickup_proofs) {
        try { parsedPickupProofs = typeof order.pickup_proofs === 'string' ? JSON.parse(order.pickup_proofs) : order.pickup_proofs; } catch(e) {}
      }

      // Group distinct shops in this order
      const shopMap = {};
      items.forEach(it => {
        const sid = String(it.product_shop_id || it.shop_id || order.shop_id || '1');
        const sname = it.item_shop_name || order.shop_name || 'ร้านค้า';
        const simg = it.product_image || order.shop_image || '';
        if (!shopMap[sid]) {
          shopMap[sid] = {
            shop_id: Number(sid),
            shop_name: sname,
            shop_image: simg,
            items: []
          };
        }
        shopMap[sid].items.push(it);
      });

      const shopsList = Object.values(shopMap).map(s => {
        const sid = String(s.shop_id);
        const isPickedUp = !!(parsedPickupProofs[sid] && parsedPickupProofs[sid].proof_image);
        let sStatus = parsedShopStatuses[sid] || order.order_status;
        if (isPickedUp) {
          sStatus = 'picked_up';
        }

        if (['delivered', 'completed', 'cancelled'].includes(order.order_status)) {
          sStatus = order.order_status;
        } else if (['delivering', 'shipped'].includes(order.order_status)) {
          sStatus = isPickedUp ? 'picked_up' : 'delivering';
        }

        return {
          ...s,
          shop_status: sStatus,
          is_picked_up: isPickedUp,
          pickup_proof_image: parsedPickupProofs[sid]?.proof_image || null,
          items_count: s.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
        };
      });

      return {
        ...order,
        shops: shopsList,
        shop_statuses: parsedShopStatuses,
        items: items.map(item => ({
          ...item,
          product_name: item.product_name || item.db_product_name || 'สินค้า',
          shop_name: item.item_shop_name || order.shop_name || 'ร้านค้า'
        })),
        item_count: items.reduce((acc, i) => acc + (i.quantity || 1), 0),
        display_title: displayTitle,
        display_image: displayImage,
        shop_name: order.shop_name || 'ร้านค้าทั่วไป',
        status_text: statusThai[order.order_status] || order.order_status,
        delivery_type_text: deliveryTypeThai[order.delivery_type] || order.delivery_type
      };
    });

    res.json({ success: true, data: formattedOrders });

  } catch (error) {
    console.error(`❌ SQL Error (/api/orders/user/${userId}):`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ดึงรายละเอียดออเดอร์เดี่ยว
app.get('/api/orders/:orderId', async (req, res) => {
  const { orderId } = req.params;
  try {
    const [orders] = await db.execute(`
      SELECT 
        orders.*, 
        shops.name AS shop_name,
        shops.image_url AS shop_image,
        del.status AS delivery_status,
        del.pickup_proof_image,
        del.proof_image AS delivery_proof_image,
        del.proof_image,
        del.pickup_at,
        del.completed_at AS delivery_completed_at,
        u_rider.full_name AS rider_name,
        u_rider.phone AS rider_phone,
        r.vehicle_plate AS rider_vehicle_plate,
        u_customer.full_name AS customer_name,
        u_customer.phone AS customer_phone
      FROM orders
      LEFT JOIN shops ON orders.shop_id = shops.shop_id
      LEFT JOIN deliveries del ON orders.order_id = del.order_id
      LEFT JOIN riders r ON (orders.rider_id = r.rider_id OR del.rider_id = r.rider_id)
      LEFT JOIN users u_rider ON r.user_id = u_rider.user_id
      LEFT JOIN users u_customer ON orders.user_id = u_customer.user_id
      WHERE orders.order_id = ?
    `, [orderId]);

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบคำสั่งซื้อ' });
    }

    const order = orders[0];
    const requestedShopId = req.query.shop_id ? String(req.query.shop_id) : null;

    const [items] = await db.execute(
      `SELECT oi.*, p.name AS db_product_name, p.shop_id AS product_shop_id,
              COALESCE(p.image_url, (SELECT image_url FROM auctions WHERE title COLLATE utf8mb4_unicode_ci = oi.product_name COLLATE utf8mb4_unicode_ci LIMIT 1)) AS product_image,
              COALESCE(s_p.name, s_oi.name, (SELECT name FROM shops WHERE shop_id = p.shop_id), (SELECT name FROM shops WHERE shop_id = oi.shop_id), '') AS item_shop_name
         FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.product_id
       LEFT JOIN shops s_p ON p.shop_id = s_p.shop_id
       LEFT JOIN shops s_oi ON oi.shop_id = s_oi.shop_id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    let parsedShopStatuses = {};
    if (order.shop_statuses) {
      try { parsedShopStatuses = typeof order.shop_statuses === 'string' ? JSON.parse(order.shop_statuses) : order.shop_statuses; } catch(e) {}
    }
    let parsedPickupProofs = {};
    if (order.pickup_proofs) {
      try { parsedPickupProofs = typeof order.pickup_proofs === 'string' ? JSON.parse(order.pickup_proofs) : order.pickup_proofs; } catch(e) {}
    }

    // Build distinct shops array
    const shopMap = {};
    items.forEach(it => {
      const sid = String(it.product_shop_id || it.shop_id || order.shop_id || '1');
      const sname = it.item_shop_name || order.shop_name || 'ร้านค้า';
      const simg = it.product_image || order.shop_image || '';
      if (!shopMap[sid]) {
        shopMap[sid] = {
          shop_id: Number(sid),
          shop_name: sname,
          shop_image: simg,
          items: []
        };
      }
      shopMap[sid].items.push(it);
    });

    const shopsList = Object.values(shopMap).map(s => {
      const sid = String(s.shop_id);
      const isPickedUp = !!(parsedPickupProofs[sid] && parsedPickupProofs[sid].proof_image);
      let sStatus = parsedShopStatuses[sid] || order.order_status;
      if (isPickedUp) sStatus = 'picked_up';

      if (['delivered', 'completed', 'cancelled'].includes(order.order_status)) {
        sStatus = order.order_status;
      } else if (['delivering', 'shipped'].includes(order.order_status)) {
        sStatus = isPickedUp ? 'picked_up' : 'delivering';
      }

      return {
        ...s,
        shop_status: sStatus,
        is_picked_up: isPickedUp,
        pickup_proof_image: parsedPickupProofs[sid]?.proof_image || null,
        items_count: s.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
      };
    });

    // If requested by seller for specific shop_id
    let itemsToReturn = items;
    let effectiveSubtotal = Number(order.subtotal || order.total_amount || 0);
    let effectiveTotal = Number(order.total_amount || 0);
    let effectiveStatus = order.order_status;

    if (requestedShopId) {
      const myShopItems = items.filter(it => 
        String(it.product_shop_id || it.shop_id) === requestedShopId ||
        (!it.shop_id && !it.product_shop_id && String(order.shop_id) === requestedShopId)
      );
      if (myShopItems.length > 0) {
        itemsToReturn = myShopItems;
        const mySubtotal = myShopItems.reduce((acc, it) => acc + (parseFloat(it.price || 0) * (it.quantity || 1)), 0);
        effectiveSubtotal = mySubtotal;
        effectiveTotal = mySubtotal;
      }
      if (parsedShopStatuses[requestedShopId]) {
        effectiveStatus = parsedShopStatuses[requestedShopId];
      }
    }

    const [reviews] = await db.execute('SELECT rating, comment, created_at FROM reviews WHERE order_id = ? LIMIT 1', [orderId]);
    res.json({
      success: true,
      order: {
        ...order,
        subtotal: effectiveSubtotal,
        total_amount: effectiveTotal,
        order_status: effectiveStatus,
        shops: shopsList,
        shop_statuses: parsedShopStatuses,
        review: reviews.length > 0 ? reviews[0] : null,
        items: itemsToReturn.map(item => ({
          ...item,
          product_name: item.product_name || item.db_product_name || 'สินค้า',
          shop_name: item.item_shop_name || order.shop_name || 'ร้านค้า'
        }))
      }
    });
  } catch (error) {
    console.error('❌ GET /api/orders/:orderId error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API สำหรับแจ้งปัญหาคำสั่งซื้อ
app.post('/api/orders/:orderId/issues', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { user_id, issue_topic, issue_detail } = req.body;

    if (!user_id || !issue_topic) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ user_id และ issue_topic' });
    }

    const [orderCheck] = await db.query('SELECT order_id FROM orders WHERE order_id = ?', [orderId]);
    if (orderCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบคำสั่งซื้อ' });
    }

    await db.query(
      'INSERT INTO order_issues (order_id, user_id, issue_topic, issue_detail, status) VALUES (?, ?, ?, ?, ?)',
      [orderId, user_id, issue_topic, issue_detail || '', 'pending']
    );

    res.json({ success: true, message: 'ส่งเรื่องร้องเรียนสำเร็จ แอดมินจะติดต่อกลับโดยเร็วที่สุด' });
  } catch (error) {
    console.error('❌ POST /api/orders/:orderId/issues error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  const { 
    user_id, 
    shop_id, 
    subtotal, 
    delivery_fee, 
    discount, 
    total_amount, 
    delivery_type, 
    payment_method, 
    receiver_name, 
    receiver_phone, 
    shipping_address, 
    latitude, 
    longitude, 
    note_for_rider, 
    items 
  } = req.body;
  
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 0. ป้องกันการปั่นยอดและโกงส่วนลด: ห้ามเจ้าของร้านสั่งสินค้าจากร้านตัวเอง (Fraud Prevention)
    if (user_id) {
      const distinctShopIds = new Set();
      if (shop_id) distinctShopIds.add(Number(shop_id));
      if (items && items.length > 0) {
        for (const item of items) {
          if (item.shop_id) distinctShopIds.add(Number(item.shop_id));
        }
      }

      if (distinctShopIds.size > 0) {
        const [ownedShops] = await connection.query(
          `SELECT shop_id, name FROM shops WHERE owner_id = ? AND shop_id IN (?)`,
          [user_id, Array.from(distinctShopIds)]
        );

        if (ownedShops.length > 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            message: `คุณไม่สามารถสั่งซื้อสินค้าจากร้านค้าของตนเองได้ ("${ownedShops[0].name}")`
          });
        }
      }
    }

    // 1. ตรวจสอบสต็อกสินค้าก่อนทุกรายการ (Stock Availability Check)
    if (items && items.length > 0) {
      for (const item of items) {
        const pId = item.product_id || item.id;
        const reqQty = parseInt(item.quantity || 1, 10);
        if (pId) {
          const [pRows] = await connection.query(
            'SELECT product_id, name, stock_quantity FROM products WHERE product_id = ? FOR UPDATE',
            [pId]
          );

          if (pRows.length > 0) {
            const product = pRows[0];
            const currentStock = parseInt(product.stock_quantity !== undefined && product.stock_quantity !== null ? product.stock_quantity : 0, 10);
            
            if (currentStock <= 0) {
              await connection.rollback();
              return res.status(400).json({ 
                success: false, 
                message: `สินค้า "${product.name}" หมดแล้ว (Out of Stock)` 
              });
            }

            if (currentStock < reqQty) {
              await connection.rollback();
              return res.status(400).json({ 
                success: false, 
                message: `สินค้า "${product.name}" คงเหลือไม่เพียงพอ (เหลือเพียง ${currentStock} ชิ้น)` 
              });
            }
          }
        }
      }
    }

        // 2. ตรวจสอบและคำนวณค่าจัดส่งตามระยะทางจริงและโครงสร้างระบบ
    const config = await getDeliveryFareConfig();
    let shopLat = 0, shopLng = 0;
    try {
      const [shopRows] = await connection.query('SELECT latitude, longitude FROM shops WHERE shop_id = ?', [shop_id || 1]);
      if (shopRows.length > 0) {
        shopLat = parseFloat(shopRows[0].latitude) || 0;
        shopLng = parseFloat(shopRows[0].longitude) || 0;
      }
    } catch (e) {}

    const distKm = calculateDistanceKm(shopLat, shopLng, latitude, longitude);
    const fareInfo = computeFare(distKm, config.baseFee, config.perKmFee, config.riderSharePercent);

    let calculatedDeliveryFee = parseFloat(delivery_fee) || 0;
    if (delivery_type === 'delivery' && calculatedDeliveryFee <= 0) {
      calculatedDeliveryFee = fareInfo.totalFare;
    }
    const finalTotalAmount = total_amount ? parseFloat(total_amount) : (parseFloat(subtotal || 0) + calculatedDeliveryFee - parseFloat(discount || 0));

    // บันทึกข้อมูลคำสั่งซื้อลงตาราง orders
    const [orderResult] = await connection.query(
      `INSERT INTO orders (
        user_id, shop_id, subtotal, delivery_fee, discount, total_amount, 
        order_status, delivery_type, payment_method, receiver_name, 
        receiver_phone, shipping_address, latitude, longitude, note_for_rider
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id || 2,
        shop_id,
        subtotal || 0,
        calculatedDeliveryFee,
        discount || 0,
        total_amount,
        delivery_type || 'delivery',
        payment_method || 'promptpay',
        receiver_name || '',
        receiver_phone || '',
        shipping_address || '',
        latitude || 0,
        longitude || 0,
        note_for_rider || ''
      ]
    );

    const orderId = orderResult.insertId;

    // 3. บันทึก order_items และตัดสต็อกสินค้าใน MySQL ทันที
    const actualShopIdsInOrder = new Set([shop_id]);

    if (items && items.length > 0) {
      for (const item of items) {
        const pId = item.product_id || item.id;
        const reqQty = parseInt(item.quantity || 1, 10);
        const itemPrice = parseFloat(item.price ?? item.discount_price ?? 0);

        // ดึง shop_id ที่ถูกต้องตามความเป็นจริงจากตาราง products
        let actualItemShopId = Number(item.shop_id || shop_id || 1);
        if (pId) {
          const [pRows] = await connection.query('SELECT shop_id FROM products WHERE product_id = ?', [pId]);
          if (pRows.length > 0 && pRows[0].shop_id) {
            actualItemShopId = Number(pRows[0].shop_id);
          }
        }

        if (actualItemShopId) {
          actualShopIdsInOrder.add(actualItemShopId);
        }

        await connection.query(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, price, shop_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, pId || null, item.product_name || item.name || '', reqQty, itemPrice, actualItemShopId]
        );

        // ตัดสต็อกสินค้าในตาราง products
        if (pId) {
          const [deductResult] = await connection.query(
            'UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - ?) WHERE product_id = ? AND stock_quantity >= ?',
            [reqQty, pId, reqQty]
          );
          console.log(`📦 ตัดสต็อกสินค้า ID: ${pId} (Shop: ${actualItemShopId}) จำนวน: ${reqQty} ชิ้น (Affected: ${deductResult.affectedRows})`);
        }
      }
    }

    // บันทึกการใช้งานคูปอง (ถ้ามี)
    if (req.body.coupon_id) {
      await connection.query('UPDATE user_coupons SET is_used = 1 WHERE id = ?', [req.body.coupon_id]);
    } else if (req.body.coupon_code && user_id) {
      await connection.query('UPDATE user_coupons SET is_used = 1 WHERE code = ? AND user_id = ? LIMIT 1', [req.body.coupon_code, user_id]);
    }

    // มอบคะแนนสะสมจากการสั่งซื้อ
    const earnedPoints = Math.max(5, Math.floor((total_amount || 0) / 10));
    try {
      await connection.query('UPDATE user_points SET points = points + ? WHERE user_id = ?', [earnedPoints, user_id || 2]);
      await connection.query('INSERT INTO user_point_history (user_id, title, points_change) VALUES (?, ?, ?)', [
        user_id || 2,
        `คะแนนจากการสั่งซื้อ #${orderId}`,
        `+${earnedPoints}`
      ]);
    } catch(e) {}

    // Notify All Shop Owners involved & Buyer
    try {
      const allShopIds = Array.from(actualShopIdsInOrder).filter(Boolean);

      for (const sId of allShopIds) {
        if (!sId) continue;
        const [sRows] = await connection.query('SELECT owner_id, name FROM shops WHERE shop_id = ?', [sId]);
        if (sRows.length > 0 && sRows[0].owner_id) {
          await connection.query(
            'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
            [sRows[0].owner_id, `🛍️ มีคำสั่งซื้อใหม่เข้ามา! (#${orderId})`, `ร้านของคุณมีรายการสินค้าในคำสั่งซื้อ #${orderId} กรุณาตรวจสอบและเตรียมสินค้า`, String(orderId)]
          );
        }
      }

      if (user_id) {
        await connection.query(
          'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
          [user_id, `📝 สร้างคำสั่งซื้อสำเร็จ (#${orderId})`, `คำสั่งซื้อ #${orderId} อยู่ระหว่างรอร้านค้ารับออเดอร์`, String(orderId)]
        );
      }
    } catch(ne) {
      console.error('Error sending order creation notifications:', ne.message);
    }

    await connection.commit();
    console.log(`✅ สั่งซื้อและตัดสต็อกสินค้าสำเร็จสำหรับ Order ID: ${orderId}`);

    // เคลียร์แคชหน้าแรกทันทีเพื่ออัปเดตสต็อกสินค้าสดใหม่
    clearCache('home-data');

    res.json({ 
      success: true, 
      message: 'สั่งซื้อและตัดสต็อกสินค้าเรียบร้อยแล้ว', 
      order_id: orderId 
    });
  } catch (error) {
    await connection.rollback();
    console.error('❌ SQL Error (POST /api/orders):', error.message);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้างคำสั่งซื้อ', error: error.message });
  } finally {
    connection.release();
  }
});

// ==========================================
// 6. PAYMENT APIs
// ==========================================

// 1. API Gen PromptPay QR Code จริงจาก เบอร์โทร/เลขผู้เสียภาษี และ ยอดเงิน
app.get('/api/payments/generate-qr', async (req, res) => {
  try {
    const { amount } = req.query;
    const targetPromptPay = "0812345678"; // ใส่เบอร์ PromptPay หรือ เลขนิติบุคคลบัญชีรับเงินของระบบคุณ
    
    // สร้าง Payload ตามมาตรฐาน EMVCo PromptPay
    const payload = generatePayload(targetPromptPay, { amount: parseFloat(amount) });
    const qrDataUrl = await QRCode.toDataURL(payload);

    res.json({ success: true, qr_image: qrDataUrl, payload });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. API ยืนยันการชำระเงินจริง + กระจายเงินเข้า Wallet ร้านค้าและไรเดอร์
app.post(['/api/payments', '/api/payments/confirm'], async (req, res) => {
  const { order_id, shop_id, rider_id, total_amount, amount, delivery_fee, payment_method } = req.body;

  const effectiveOrderId = order_id;
  const effectiveAmount = parseFloat(total_amount || amount) || 0;

  // ใช้ Connection จาก Pool เพื่อทำ Transaction
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.query('SELECT * FROM orders WHERE order_id = ?', [effectiveOrderId]);
    const orderData = orderRows.length > 0 ? orderRows[0] : {};
    const targetShopId = shop_id || orderData.shop_id || 1;
    const fee = parseFloat(delivery_fee || orderData.delivery_fee) || 0;
    const shopAmount = effectiveAmount > 0 ? effectiveAmount - fee : (parseFloat(orderData.total_amount) || 0) - fee;
    const riderAmount = fee;

    // 1. บันทึกลงตาราง payments (ประวัติการชำระเงิน)
    await connection.query(`
      INSERT INTO payments (order_id, payment_method, payment_status, amount, paid_at)
      VALUES (?, ?, 'success', ?, NOW())
    `, [effectiveOrderId, payment_method || 'promptpay', effectiveAmount]);

    // 2. อัปเดตสถานะออเดอร์เป็น 'pending' (รอร้านค้ายืนยัน)
    await connection.query(`
      UPDATE orders 
      SET order_status = 'pending'
      WHERE order_id = ?
    `, [effectiveOrderId]);

        // 3. (ถูกระงับด้วยระบบ Escrow) ไม่เติมเงินเข้า Wallet ร้านค้าทันที
    // เงินจะเข้ากระเป๋าร้านค้าเมื่อลูกค้ายืนยันการรับสินค้าผ่าน /api/orders/:orderId/complete
    /*
    if (targetShopId) {
      await connection.query(`
        INSERT INTO shop_wallets (shop_id, balance) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)
      `, [targetShopId, shopAmount]);

      await connection.query(`
        INSERT INTO wallet_transactions (user_type, target_id, order_id, amount, type, description)
        VALUES ('shop', ?, ?, ?, 'credit', ?)
      `, [targetShopId, effectiveOrderId, shopAmount, const stats = { today_sales: (statsData[0].today_sales || 0) - (statsData[0].total_gp || 0), today_orders: statsData[0].today_orders || 0 };`รายรับจากออเดอร์ #${effectiveOrderId}const stats = {const stats = {\n      today_sales: (statsData[0].today_sales || 0) - (statsData[0].total_gp || 0),\n      today_orders: statsData[0].today_orders || 0\n    };n      today_sales: (statsData[0].today_sales || 0) - (statsData[0].total_gp || 0),\n      today_orders: statsData[0].today_orders || 0\n        // INJECTED LINE TO FIND\n    };`]);
    }
    */

    // 4. เติมเงินเข้า Wallet ไรเดอร์ (ถ้ามี) + บันทึก Log
    if (rider_id) {
      await connection.query(`
        INSERT INTO rider_wallets (rider_id, balance) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)
      `, [rider_id, riderAmount]);

      await connection.query(`
        INSERT INTO wallet_transactions (user_type, target_id, order_id, amount, type, description)
        VALUES ('rider', ?, ?, ?, 'credit', ?)
      `, [rider_id, effectiveOrderId, riderAmount, `ค่าจัดส่งออเดอร์ #${effectiveOrderId}`]);
    }

    await connection.commit();
    res.json({ success: true, message: "บันทึกการชำระเงินและกระจายยอดเข้า Wallet เรียบร้อย" });

  } catch (error) {
    await connection.rollback();
    console.error('Payment Confirmation Error:', error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล", error: error.message });
  } finally {
    connection.release();
  }
});

// ==========================================
// API ยืนยันรับสินค้า (Escrow System)
// ==========================================
app.put('/api/orders/:orderId/complete', async (req, res) => {
  const orderId = req.params.orderId;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.query('SELECT * FROM orders WHERE order_id = ? FOR UPDATE', [orderId]);
    if (orderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'ไม่พบคำสั่งซื้อ' });
    }

    const order = orderRows[0];
    if (order.order_status === 'completed') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'คำสั่งซื้อนี้เสร็จสมบูรณ์ไปแล้ว' });
    }

    // 1. อัปเดตสถานะคำสั่งซื้อและการจัดส่งเป็น completed (เสร็จสมบูรณ์ 100%)
    await connection.query('UPDATE orders SET order_status = "completed", delivered_at = NOW() WHERE order_id = ?', [orderId]);
    await connection.query('UPDATE deliveries SET status = "completed", completed_at = NOW() WHERE order_id = ?', [orderId]);

    // 2. คำนวณและโอนเงินเข้ากระเป๋าร้านค้า (Merchant Escrow Release)
    const shopId = order.shop_id;
    const totalAmount = parseFloat(order.total_amount) || 0;
    const deliveryFee = parseFloat(order.delivery_fee) || 0;
    const shopAmount = totalAmount - deliveryFee;

    if (shopId && shopAmount > 0) {
      await connection.query(`
        INSERT INTO shop_wallets (shop_id, balance) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)
      `, [shopId, shopAmount]);

      await connection.query(`
        INSERT INTO wallet_transactions (user_type, target_id, order_id, amount, type, description)
        VALUES ('shop', ?, ?, ?, 'credit', ?)
      `, [shopId, orderId, shopAmount, `รายรับจากออเดอร์ #${orderId}`]);
    }

    // Notify Shop Owner
    try {
      if (shopId) {
        const [sRows] = await connection.query('SELECT owner_id FROM shops WHERE shop_id = ?', [shopId]);
        if (sRows.length > 0 && sRows[0].owner_id) {
          await connection.query(
            'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
            [sRows[0].owner_id, `💰 ลูกค้ายืนยันรับสินค้าแล้ว (#${orderId})`, `คำสั่งซื้อ #${orderId} เสร็จสมบูรณ์ ยอดเงิน ฿${shopAmount} ได้เข้ากระเป๋าเงินร้านค้าของคุณเรียบร้อยแล้ว`, String(orderId)]
          );
        }
      }
    } catch(ne) {}

    // 3. ปล่อยเงินค่ารอบเข้ากระเป๋าไรเดอร์เมื่อลูกค้ายืนยันรับสินค้าแล้วเท่านั้น (Rider Escrow Release)
    const [delRows] = await connection.query('SELECT rider_id FROM deliveries WHERE order_id = ?', [orderId]);
    if (delRows.length > 0 && delRows[0].rider_id && deliveryFee > 0) {
      const riderId = delRows[0].rider_id;
      await connection.query(`
        INSERT INTO rider_wallets (rider_id, balance) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)
      `, [riderId, deliveryFee]);

      await connection.query(`
        INSERT INTO wallet_transactions (user_type, target_id, order_id, amount, type, description)
        VALUES ('rider', ?, ?, ?, 'credit', ?)
      `, [riderId, orderId, deliveryFee, `ค่ารอบจัดส่งออเดอร์ #${orderId} (ลูกค้ายืนยันรับสินค้าแล้ว)`]);
    }

    await connection.commit();
    res.json({ success: true, message: 'ยืนยันรับสินค้าและโอนเงินให้ร้านค้าสำเร็จ' });
  } catch (error) {
    await connection.rollback();
    console.error('Order Complete Error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการยืนยันรับสินค้า' });
  } finally {
    connection.release();
  }
});

// ==========================================
// 6.3 AUCTION APIs (ระบบประมูลสินค้าหายาก Flash Auction)
// ==========================================

// 1. ดึงห้องประมูลที่กำลังเปิดอยู่ (สำหรับหน้าแรกและห้องประมูล)
app.get(['/api/auctions', '/api/auctions/active'], async (req, res) => {
  try {
    const cachedAuctions = getCache('auctions-active');
    if (cachedAuctions) {
      return res.json(cachedAuctions);
    }

    const [auctions] = await db.execute(`
      SELECT a.*, CAST(a.end_time AS CHAR) AS end_time_str,
        (SELECT COUNT(*) FROM auction_bids WHERE auction_id = a.auction_id) AS total_bids
      FROM auctions a
      WHERE a.auction_status = 'active'
      ORDER BY RAND()
    `);

    const now = new Date();
    const result = auctions.map(a => {
      let endTimeStr = a.end_time_str;
      if (!endTimeStr && a.end_time) { endTimeStr = typeof a.end_time === 'string' ? a.end_time : (JSON.stringify(a.end_time) === '{}' ? '' : a.end_time.toString()); }
      let endTime = endTimeStr ? new Date(endTimeStr.replace(/ /g, 'T')) : new Date(0);
      if (isNaN(endTime.getTime())) endTime = new Date(0);
      const diff = endTime - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const startPrice = parseFloat(a.start_price || 89);
      let originalPrice = parseFloat(a.original_price);
      let discountPercent = parseInt(a.discount_percent, 10);

      if (!originalPrice || isNaN(originalPrice) || originalPrice <= startPrice) {
        discountPercent = discountPercent || 80;
        originalPrice = Math.round(startPrice / (1 - discountPercent / 100));
      } else if (!discountPercent || isNaN(discountPercent)) {
        discountPercent = Math.round(((originalPrice - startPrice) / originalPrice) * 100);
      }

      return {
        ...a,
        start_price: startPrice,
        current_bid: parseFloat(a.current_bid || startPrice),
        original_price: originalPrice,
        discount_percent: discountPercent,
        time_remaining_text: diff > 0 ? `${hours} ชม. ${minutes} นาที` : 'หมดเวลา',
        time_remaining_ms: Math.max(0, diff),
        hours: Math.max(0, hours),
        minutes: Math.max(0, minutes),
        seconds: Math.max(0, seconds)
      };
    });

    const validAuctions = result.filter(a => a.time_remaining_ms > 0);
    const auctionResponse = { success: true, auctions: result, active_auction: validAuctions[0] || null };

    // แคชห้องประมูล 15 วินาที
    setCache('auctions-active', auctionResponse, 15);

    res.json(auctionResponse);
  } catch (error) {
    console.error('❌ GET /api/auctions error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. ดึงรายละเอียดห้องประมูลเดี่ยว + ประวัติการเสนอราคา (Leaderboard)
app.get('/api/auctions/:auctionId', async (req, res) => {
  let { auctionId } = req.params;
  let targetId = parseInt(auctionId, 10);
  if (isNaN(targetId) || targetId <= 0) {
    targetId = 1;
  }

  try {
    let [rows] = await db.execute(`
      SELECT a.*, CAST(a.end_time AS CHAR) AS end_time_str,
        (SELECT COUNT(*) FROM auction_bids WHERE auction_id = a.auction_id) AS total_bids
      FROM auctions a
      WHERE a.auction_id = ?
    `, [targetId]);

    // หากไม่พบ ID ที่ระบุ ให้ fallback ไปยังห้องประมูลที่เปิดอยู่ หรือห้องแรกสุด
    if (rows.length === 0) {
      const [fallback] = await db.execute(`
        SELECT a.*, CAST(a.end_time AS CHAR) AS end_time_str,
        (SELECT COUNT(*) FROM auction_bids WHERE auction_id = a.auction_id) AS total_bids
        FROM auctions a
        WHERE a.auction_status = 'active'
        ORDER BY a.auction_id ASC
        LIMIT 1
      `);
      if (fallback.length > 0) {
        rows = fallback;
        targetId = fallback[0].auction_id;
      } else {
        const [anyRows] = await db.execute(`
          SELECT a.*, CAST(a.end_time AS CHAR) AS end_time_str,
        (SELECT COUNT(*) FROM auction_bids WHERE auction_id = a.auction_id) AS total_bids
          FROM auctions a
          ORDER BY a.auction_id ASC
          LIMIT 1
        `);
        rows = anyRows;
        if (anyRows.length > 0) targetId = anyRows[0].auction_id;
      }
    }

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการประมูล' });
    }

    const auction = rows[0];

    // ประวัติการเสนอราคาเรียงจากสูงสุดไปต่ำสุด
    const [bids] = await db.execute(`
      SELECT ab.*, u.full_name, u.phone
      FROM auction_bids ab
      LEFT JOIN users u ON ab.user_id = u.user_id
      WHERE ab.auction_id = ?
      ORDER BY ab.bid_amount DESC, ab.created_at DESC
      LIMIT 15
    `, [targetId]);

    const now = new Date();
    const endTime = new Date(auction.end_time);
    const diff = endTime - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const defaultNames = ['อรวรรณ รักษ์เจริญ', 'พิเชษฐ์ เลิศสุข', 'ธนกฤต สุขสวัสดิ์', 'นงลักษณ์ ใจงาม'];

    const formattedBids = bids.map((b, idx) => {
      let displayName = b.full_name;
      if (!displayName || displayName === 'lil' || displayName === 'oooo') {
        displayName = b.user_id === 1 ? 'อรวรรณ รักษ์เจริญ' : b.user_id === 2 ? 'สมชาย ใจดี' : defaultNames[idx % defaultNames.length];
      }

      const d = new Date(b.created_at);
      const hh = d.getHours().toString().padStart(2, '0');
      const mm = d.getMinutes().toString().padStart(2, '0');

      return {
        bid_id: b.bid_id,
        user_id: b.user_id,
        bid_amount: parseFloat(b.bid_amount),
        bidder_name: displayName,
        formatted_time: `${hh}:${mm}`,
        created_at: b.created_at,
        bid_status: b.bid_status
      };
    });

    const startPrice = parseFloat(auction.start_price || 89);
    let originalPrice = parseFloat(auction.original_price);
    let discountPercent = parseInt(auction.discount_percent, 10);

    if (!originalPrice || isNaN(originalPrice) || originalPrice <= startPrice) {
      discountPercent = discountPercent || 80;
      originalPrice = Math.round(startPrice / (1 - discountPercent / 100));
    } else if (!discountPercent || isNaN(discountPercent)) {
      discountPercent = Math.round(((originalPrice - startPrice) / originalPrice) * 100);
    }

    res.json({
      success: true,
      auction: {
        ...auction,
        end_time: auction.end_time ? new Date(auction.end_time).toISOString() : null,
        start_price: startPrice,
        original_price: originalPrice,
        discount_percent: discountPercent,
        current_bid: parseFloat(auction.current_bid || startPrice),
        min_increment: parseFloat(auction.min_increment || 10),
        time_remaining_text: diff > 0 ? `${hours} ชม. ${minutes} นาที` : 'หมดเวลา',
        time_remaining_ms: Math.max(0, diff),
        hours: Math.max(0, hours),
        minutes: Math.max(0, minutes),
        seconds: Math.max(0, seconds),
        is_ended: auction.auction_status === 'ended' || diff <= 0
      },
      bids: formattedBids
    });
  } catch (error) {
    console.error('❌ GET /api/auctions/:id error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. เสนอราคาประมูล (Real-time Bidding)
app.post('/api/auctions/:auctionId/bid', async (req, res) => {
  const { auctionId } = req.params;
  const { user_id, bid_amount } = req.body;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT * FROM auctions WHERE auction_id = ? FOR UPDATE',
      [auctionId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'ไม่พบรายการประมูล' });
    }

    const auction = rows[0];
    if (auction.auction_status === 'ended') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'การประมูลสิ้นสุดแล้ว' });
    }

    const currentBid = parseFloat(auction.current_bid || auction.start_price);
    const minIncrement = parseFloat(auction.min_increment || 100);
    const bidAmt = parseFloat(bid_amount);

    if (isNaN(bidAmt) || bidAmt <= currentBid) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `ต้องเสนอราคามากกว่าราคาปัจจุบัน ฿${currentBid.toLocaleString()}`
      });
    }

    // ตรวจสอบหาผู้เสนอราคาสูงสุดคนก่อนหน้า ก่อนที่จะถูกแซงราคา
    const [previousActiveBids] = await connection.query(
      'SELECT user_id, bid_amount FROM auction_bids WHERE auction_id = ? AND bid_status = "active" ORDER BY bid_amount DESC LIMIT 1',
      [auctionId]
    );
    const previousBidder = previousActiveBids.length > 0 ? previousActiveBids[0] : null;

    // อัปเดตสถานะ bid เก่าเป็น outbid
    await connection.query(
      'UPDATE auction_bids SET bid_status = "outbid" WHERE auction_id = ? AND bid_status = "active"',
      [auctionId]
    );

    // บันทึก bid ใหม่
    const effectiveUserId = user_id || 2;
    await connection.query(
      'INSERT INTO auction_bids (auction_id, user_id, bid_amount, bid_status, created_at) VALUES (?, ?, ?, "active", NOW())',
      [auctionId, effectiveUserId, bidAmt]
    );

    // อัปเดต current_bid และ highest_bidder_id ใน auctions
    await connection.query(
      'UPDATE auctions SET current_bid = ?, winner_user_id = ? WHERE auction_id = ?',
      [bidAmt, effectiveUserId, auctionId]
    );

    // หากมีผู้เสนอราคาก่อนหน้าที่ไม่ใช่คนเดียวกัน ให้ส่งการแจ้งเตือนถูกแซงราคา (auction_outbid)
    if (previousBidder && Number(previousBidder.user_id) !== Number(effectiveUserId)) {
      await connection.query(
        `INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at)
         VALUES (?, ?, ?, 'auction_outbid', ?, 0, NOW())`,
        [
          previousBidder.user_id,
          'คุณถูกแซงราคาประมูล!',
          `มีผู้เสนอราคาสูงกว่าคุณในสินค้า "${auction.title}" ที่ราคา ฿${bidAmt.toLocaleString()}`,
          auctionId
        ]
      );
      console.log(`🔔 แจ้งเตือนผู้ใช้ ${previousBidder.user_id} ว่าถูกแซงราคาในห้อง #${auctionId}`);
    }

    const [shops] = await connection.query('SELECT owner_id FROM shops WHERE shop_id = ?', [auction.shop_id]);
    if (shops.length > 0 && shops[0].owner_id) {
      await connection.query(
        `INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at)
         VALUES (?, ?, ?, 'shop_auction_bid', ?, 0, NOW())`,
        [
          shops[0].owner_id,
          'มีผู้เสนอราคาใหม่ในห้องประมูล!',
          `สินค้า "${auction.title}" มีผู้เสนอราคาล่าสุดที่ ฿${bidAmt.toLocaleString()}`,
          auctionId
        ]
      );
    }

    await connection.commit();

    // ดึงประวัติ bids ล่าสุดกลับไปให้ Frontend ทันที
    const [latestBids] = await db.execute(`
      SELECT ab.*, u.full_name
      FROM auction_bids ab
      LEFT JOIN users u ON ab.user_id = u.user_id
      WHERE ab.auction_id = ?
      ORDER BY ab.bid_amount DESC, ab.created_at DESC
      LIMIT 15
    `, [auctionId]);

    const formattedBids = latestBids.map((b) => {
      const d = new Date(b.created_at);
      const hh = d.getHours().toString().padStart(2, '0');
      const mm = d.getMinutes().toString().padStart(2, '0');
      return {
        bid_id: b.bid_id,
        user_id: b.user_id,
        bid_amount: parseFloat(b.bid_amount),
        bidder_name: b.full_name || (b.user_id === 2 ? 'สมชาย ใจดี' : 'ผู้เสนอราคา'),
        formatted_time: `${hh}:${mm}`,
        created_at: b.created_at,
        bid_status: b.bid_status
      };
    });

    res.json({
      success: true,
      message: `เสนอราคา ฿${bidAmt.toLocaleString()} สำเร็จแล้ว!`,
      new_current_bid: bidAmt,
      next_min_bid: bidAmt + minIncrement,
      bids: formattedBids
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ POST /api/auctions/:id/bid error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

// 4. ปิดการประมูลเมื่อหมดเวลา + สร้าง Order ให้ผู้ชนะอัตโนมัติ + แจ้งเตือนผู้ชนะและผู้ร่วมประมูล
app.post('/api/auctions/:auctionId/close', async (req, res) => {
  const { auctionId } = req.params;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT * FROM auctions WHERE auction_id = ? FOR UPDATE',
      [auctionId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'ไม่พบรายการประมูล' });
    }

    const auction = rows[0];

    // ดึงข้อมูลผู้เสนอราคาสูงสุด
    const [topBids] = await connection.query(`
      SELECT ab.*, u.full_name, u.phone
      FROM auction_bids ab
      LEFT JOIN users u ON ab.user_id = u.user_id
      WHERE ab.auction_id = ?
      ORDER BY ab.bid_amount DESC, ab.created_at ASC
      LIMIT 1
    `, [auctionId]);

        const winnerBid = topBids.length > 0 ? topBids[0] : null;

    if (!winnerBid) {
      await connection.query(
        'UPDATE auctions SET auction_status = "ended" WHERE auction_id = ?',
        [auctionId]
      );
      await connection.commit();
      return res.json({
        success: true,
        message: 'ปิดการประมูลเรียบร้อย (ไม่มีผู้เสนอราคา)'
      });
    }

    const winnerUserId = winnerBid.user_id;
    const winAmount = parseFloat(winnerBid.bid_amount);
    const winnerName = winnerBid.full_name || 'ผู้ชนะการประมูล';

    // อัปเดตสถานะการประมูลเป็น 'ended'
    await connection.query(
      'UPDATE auctions SET auction_status = "ended", winner_user_id = ? WHERE auction_id = ?',
      [winnerUserId, auctionId]
    );

    // ตรวจสอบว่ามี Order จากการประมูลนี้อยู่แล้วหรือไม่
    const [existingOrders] = await connection.query(
      'SELECT order_id FROM orders WHERE user_id = ? AND order_type = "auction" AND total_amount = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)',
      [winnerUserId, winAmount]
    );

    let createdOrderId = null;
    if (existingOrders.length > 0) {
      createdOrderId = existingOrders[0].order_id;
    } else {
      // สร้าง Order ใหม่
      const [orderResult] = await connection.query(`
        INSERT INTO orders (
          user_id, shop_id, subtotal, delivery_fee, discount, total_amount,
          order_status, order_type, delivery_type, payment_method, receiver_name,
          receiver_phone, shipping_address
        ) VALUES (?, ?, ?, 0, 0, ?, 'pending', 'auction', 'delivery', 'promptpay', ?, ?, 'ที่อยู่ตามโปรไฟล์')
      `, [
        winnerUserId,
        auction.shop_id || 1,
        winAmount,
        winAmount,
        winnerName,
        winnerBid?.phone || '0812345678'
      ]);

      createdOrderId = orderResult.insertId;

      // เพิ่ม Order Item
      await connection.query(`
        INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
        VALUES (?, NULL, ?, ?, 1)
      `, [createdOrderId, auction.title, winAmount]);
    }

    // 1. ส่งแจ้งเตือนไปยังผู้ชนะการประมูล (auction_won)
    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at)
       VALUES (?, ?, ?, 'auction_won', ?, 0, NOW())`,
      [
        winnerUserId,
        'ยินดีด้วย! คุณชนะการประมูล 🎉',
        `ยินดีด้วย! คุณชนะการประมูล "${auction.title}" ในราคา ฿${winAmount.toLocaleString()} กรุณาชำระเงินภายในเวลาที่กำหนด`,
        createdOrderId || auctionId
      ]
    );
    console.log(`🔔 แจ้งเตือนผู้ชนะ User ${winnerUserId} สำหรับห้อง #${auctionId} Order #${createdOrderId}`);

    // 2. ส่งแจ้งเตือนไปยังผู้เข้าร่วมประมูลคนอื่นๆ (auction_lost)
    const [otherBidders] = await connection.query(
      'SELECT DISTINCT user_id FROM auction_bids WHERE auction_id = ? AND user_id != ?',
      [auctionId, winnerUserId]
    );

    for (const bidder of otherBidders) {
      await connection.query(
        `INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at)
         VALUES (?, ?, ?, 'auction_lost', ?, 0, NOW())`,
        [
          bidder.user_id,
          'การประมูลสิ้นสุดแล้ว',
          `การประมูล "${auction.title}" สิ้นสุดลงแล้ว คุณไม่ได้รับสิทธิ์ในรอบนี้`,
          auctionId
        ]
      );
      console.log(`🔔 แจ้งเตือนผู้ไม่ชนะ User ${bidder.user_id} สำหรับห้อง #${auctionId}`);
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'ปิดการประมูลและสร้างคำสั่งซื้อสำเร็จ',
      winner_user_id: winnerUserId,
      winner_name: winnerName,
      win_amount: winAmount,
      order_id: createdOrderId
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ POST /api/auctions/:id/close error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

// ==========================================
// 6.4 NOTIFICATIONS APIs (ระบบการแจ้งเตือน)
// ==========================================

// 1. ดึงรายการแจ้งเตือนทั้งหมดของผู้ใช้ เรียงจากล่าสุด
app.get('/api/notifications/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId || userId === 'undefined' || userId === 'null') {
    return res.status(400).json({ success: false, message: 'ไม่พบรหัสผู้ใช้งาน' });
  }

  try {
    const [rows] = await db.execute(`
      SELECT 
        n.*,
        o.total_amount,
        o.order_status,
        o.shop_id,
        s.name AS shop_name,
        a.title AS auction_title,
        a.image_url AS auction_image
      FROM notifications n
      LEFT JOIN orders o ON (n.type = 'auction_won' OR n.type = 'order_status') AND n.reference_id = o.order_id
      LEFT JOIN shops s ON o.shop_id = s.shop_id
      LEFT JOIN auctions a ON (n.type = 'auction_outbid' OR n.type = 'auction_lost') AND n.reference_id = a.auction_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
    `, [userId]);

    const now = Date.now();
    const formatted = rows.map(item => {
      const createdAtTime = new Date(item.created_at).getTime();
      const diffSec = Math.max(0, Math.floor((now - createdAtTime) / 1000));
      let timeAgo = 'เมื่อสักครู่';

      if (diffSec < 60) {
        timeAgo = 'เมื่อสักครู่';
      } else if (diffSec < 3600) {
        timeAgo = `${Math.floor(diffSec / 60)} นาทีที่แล้ว`;
      } else if (diffSec < 86400) {
        timeAgo = `${Math.floor(diffSec / 3600)} ชั่วโมงที่แล้ว`;
      } else if (diffSec < 86400 * 7) {
        timeAgo = `${Math.floor(diffSec / 86400)} วันที่แล้ว`;
      } else {
        const d = new Date(item.created_at);
        timeAgo = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      }

      return {
        notification_id: item.notification_id,
        user_id: item.user_id,
        title: item.title,
        message: item.message,
        type: item.type,
        reference_id: item.reference_id,
        is_read: item.is_read === 1 || item.is_read === true,
        created_at: item.created_at,
        time_ago: timeAgo,
        auction_title: item.auction_title || null,
        auction_image: item.auction_image || null,
        order: item.total_amount !== null && item.total_amount !== undefined ? {
          order_id: item.reference_id,
          total_amount: parseFloat(item.total_amount),
          order_status: item.order_status,
          shop_id: item.shop_id,
          shop_name: item.shop_name
        } : null
      };
    });

    const unreadCount = formatted.filter(n => !n.is_read).length;

    res.json({
      success: true,
      notifications: formatted,
      unread_count: unreadCount,
      count: unreadCount
    });
  } catch (error) {
    console.error(`❌ GET /api/notifications/${userId} error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. ดึงจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน (Badge Count)
app.get('/api/notifications/unread-count/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId || userId === 'undefined' || userId === 'null') {
    return res.json({ success: true, count: 0, unread_count: 0 });
  }

  try {
    const [rows] = await db.execute(
      'SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    const count = rows[0]?.unread_count || 0;
    res.json({
      success: true,
      count: parseInt(count, 10),
      unread_count: parseInt(count, 10)
    });
  } catch (error) {
    console.error(`❌ GET /api/notifications/unread-count/${userId} error:`, error.message);
    res.status(500).json({ success: false, count: 0, unread_count: 0, error: error.message });
  }
});

// 3. อัปเดตสถานะเป็นอ่านแล้ว (เดี่ยว)
app.put('/api/notifications/:id/read', async (req, res) => {
  const { id } = req.params;

  try {
    await db.execute('UPDATE notifications SET is_read = 1 WHERE notification_id = ?', [id]);
    res.json({ success: true, message: 'อัปเดตสถานะเป็นอ่านแล้ว' });
  } catch (error) {
    console.error(`❌ PUT /api/notifications/${id}/read error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. อัปเดตสถานะเป็นอ่านแล้วทั้งหมด (Mark All as Read)
app.put('/api/notifications/read-all/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    await db.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    res.json({ success: true, message: 'ทำเครื่องหมายว่าอ่านทั้งหมดแล้ว' });
  } catch (error) {
    console.error(`❌ PUT /api/notifications/read-all/${userId} error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. ลบการแจ้งเตือน
// 6.5 REVIEWS & REWARDS APIs
// ==========================================

// 1. บันทึกรีวิวและคะแนนดาว
app.post('/api/reviews', async (req, res) => {
  const { 
    order_id, 
    user_id, 
    product_id, 
    shop_id, 
    rating, 
    comment, 
    image_url,
    rider_id,
    rider_rating,
    rider_comment
  } = req.body;

  try {
    let effectiveShopId = shop_id;
    let effectiveRiderId = rider_id;

    // Auto-resolve shop_id and rider_id from order if missing
    if (order_id && (!effectiveShopId || !effectiveRiderId)) {
      try {
        const [ordRows] = await db.execute(
          `SELECT o.shop_id, o.rider_id, d.rider_id as del_rider_id 
           FROM orders o 
           LEFT JOIN deliveries d ON o.order_id = d.order_id 
           WHERE o.order_id = ? LIMIT 1`,
          [order_id]
        );
        if (ordRows.length > 0) {
          if (!effectiveShopId) effectiveShopId = ordRows[0].shop_id;
          if (!effectiveRiderId) effectiveRiderId = ordRows[0].del_rider_id || ordRows[0].rider_id;
        }
      } catch (err) {
        console.error('Order lookup error in review:', err.message);
      }
    }

    const [result] = await db.execute(
      `INSERT INTO reviews (order_id, user_id, product_id, shop_id, rating, comment, image_url, rider_id, rider_rating, rider_comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order_id || null, 
        user_id || 2, 
        product_id || null, 
        effectiveShopId || 1, 
        rating !== undefined && rating !== null ? rating : 5, 
        comment || '', 
        image_url || null,
        effectiveRiderId || null,
        rider_rating !== undefined && rider_rating !== null ? rider_rating : null,
        rider_comment || null
      ]
    );

    // Recalculate & Update Shop Rating
    if (effectiveShopId) {
      try {
        await db.execute(
          `UPDATE shops 
           SET rating = (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE shop_id = ?) 
           WHERE shop_id = ?`,
          [effectiveShopId, effectiveShopId]
        );
      } catch (e) {
        console.error('Update shop rating error:', e.message);
      }
    }

    // Recalculate & Update Rider Rating
    if (effectiveRiderId && rider_rating !== undefined && rider_rating !== null) {
      try {
        await db.execute(
          `UPDATE riders 
           SET rating = (SELECT ROUND(AVG(rider_rating), 1) FROM reviews WHERE rider_id = ? AND rider_rating IS NOT NULL) 
           WHERE rider_id = ?`,
          [effectiveRiderId, effectiveRiderId]
        );
      } catch (e) {
        console.error('Update rider rating error:', e.message);
      }
    }

    // Give points to user
    await db.execute(
      `INSERT INTO user_points (user_id, points) VALUES (?, 1300)
       ON DUPLICATE KEY UPDATE points = points + 50`,
      [user_id || 2]
    );

    res.json({ 
      success: true, 
      message: 'บันทึกรีวิวสำเร็จ ขอบคุณที่แบ่งปันความคิดเห็น!', 
      review_id: result.insertId 
    });
  } catch (error) {
    console.error('❌ POST /api/reviews error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. ดึงรีวิวของสินค้า / ร้าน
app.get('/api/reviews/product/:productId', async (req, res) => {
  const { productId } = req.params;
  try {
    const [reviews] = await db.execute(
      `SELECT r.*, u.full_name AS user_name 
       FROM reviews r 
       LEFT JOIN users u ON r.user_id = u.user_id
       WHERE r.product_id = ? 
       ORDER BY r.created_at DESC`,
      [productId]
    );
    res.json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. ดึงคะแนนสะสมของผู้ใช้
app.get('/api/points/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await db.execute('SELECT points FROM user_points WHERE user_id = ?', [userId]);
    const points = rows.length > 0 ? rows[0].points : 1250;
    res.json({
      success: true,
      points,
      history: [
        { id: 1, title: 'ได้รับคะแนนจากการสั่งซื้ออาหาร #24', points: '+25', date: '20 ส.ค. 2569' },
        { id: 2, title: 'ได้รับคะแนนโบนัสต้อนรับสมาชิกใหม่', points: '+1,000', date: '15 ส.ค. 2569' },
        { id: 3, title: 'รีวิวอาหารได้รับพอยท์', points: '+50', date: '18 ส.ค. 2569' },
        { id: 4, title: 'ลดขยะอาหารพรีเมียม ช่วยสิ่งแวดล้อม', points: '+175', date: '19 ส.ค. 2569' }
      ]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. ติดตามสถานะออเดอร์ (Live Order Tracking)
app.get('/api/orders/:orderId/tracking', async (req, res) => {
  const { orderId } = req.params;
  try {
    const [orders] = await db.execute(
      `SELECT 
        o.*, 
        s.name AS shop_name,
        s.image_url AS shop_image,
        del.status,
        del.assigned_at,
        del.delivered_at,
        del.proof_image,
        del.pickup_proof_image,
        u_rider.full_name AS rider_name,
        u_rider.phone AS rider_phone,
        r.vehicle_type,
        r.license_plate
      FROM orders o
      LEFT JOIN shops s ON o.shop_id = s.shop_id
      LEFT JOIN deliveries del ON o.order_id = del.order_id
      LEFT JOIN riders r ON del.rider_id = r.rider_id
      LEFT JOIN users u_rider ON r.user_id = u_rider.user_id
      WHERE o.order_id = ?`,
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบคำสั่งซื้อ' });
    }

    const order = orders[0];
    const [items] = await db.execute(
      `SELECT oi.*, p.name AS db_product_name, COALESCE(p.image_url, (SELECT image_url FROM auctions WHERE title COLLATE utf8mb4_unicode_ci = oi.product_name COLLATE utf8mb4_unicode_ci LIMIT 1)) AS product_image
         FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.product_id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    const trackingData = {
      order_id: order.order_id,
      ref_code: `#SD-99${order.order_id}`,
      order_status: order.order_status,
      delivery_status: order.delivery_status || 'picked_up',
      status_title: order.order_status === 'completed' ? 'สินค้ามาถึงแล้ว' : 'คนขับกำลังไปรับสินค้า',
      eta_text: '12:45 น.',
      eta_minutes: '5 นาที',
      shop_name: order.shop_name || 'ร้านอาหารไทยรสเด็ด',
      shop_image: order.shop_image,
      shipping_address: order.shipping_address,
      proof_image: order.proof_image || null,
      pickup_proof_image: order.pickup_proof_image || null,
      receiver_name: order.receiver_name,
      receiver_phone: order.receiver_phone,
      rider: {
        name: order.rider_name || 'สมชาย ใจดี',
        phone: order.rider_phone || '081-234-5678',
        rating: '4.9',
        vehicle: order.license_plate ? `ทะเบียน ${order.license_plate} (${order.vehicle_type || 'รถจักรยานยนต์'})` : 'ทะเบียน กข-1234 (รถจักรยานยนต์)',
        tag: 'ฉีดวัคซีนแล้ว 3 เข็ม',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'
      },
      steps: [
        {
          id: 1,
          title: 'กำลังจัดเตรียมสินค้า',
          subtitle: 'เสร็จสิ้นเมื่อ 12:10 น.',
          completed: true,
          current: false,
          icon: 'check'
        },
        {
          id: 2,
          title: 'คนขับกำลังไปรับสินค้า',
          subtitle: 'กำลังดำเนินการ',
          completed: false,
          current: true,
          icon: 'two-wheeler'
        },
        {
          id: 3,
          title: 'กำลังนำส่งสินค้า',
          subtitle: 'รอการดำเนินการ',
          completed: false,
          current: false,
          icon: 'near-me'
        },
        {
          id: 4,
          title: 'สินค้ามาถึงแล้ว',
          subtitle: 'จัดส่งสำเร็จเมื่อ 12:45 น.',
          completed: false,
          current: false,
          icon: 'check-circle'
        }
      ],
      items: items.map(item => ({
        ...item,
        product_name: item.product_name || item.db_product_name || 'สินค้า'
      }))
    };

    res.json({ success: true, tracking: trackingData });
  } catch (error) {
    console.error('❌ Tracking error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 7. MERCHANT / SHOP MANAGEMENT APIs
// ==========================================

// ดึงรายการหมวดหมู่สินค้าทั้งหมด
app.get('/api/categories', async (req, res) => {
  try {
    const [categories] = await db.execute('SELECT * FROM categories ORDER BY category_id ASC');
    res.json({ success: true, categories });
  } catch (error) {
    console.error('❌ GET /api/categories error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ดึงรายการร้านค้าทั้งหมด
// ตรวจสอบว่าผู้ใช้มีร้านค้าหรือไม่
app.get('/api/users/:userId/shop', async (req, res) => {
  const { userId } = req.params;
  try {
    const [shops] = await db.execute('SELECT * FROM shops WHERE owner_id = ? LIMIT 1', [userId]);
    if (shops.length > 0) {
      res.json({ success: true, hasShop: true, shop: shops[0] });
    } else {
      res.json({ success: true, hasShop: false });
    }
  } catch (error) {
    console.error(`❌ GET /api/users/${userId}/shop error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// สมัครร้านค้าใหม่
app.post('/api/shops/register', upload.fields([
  { name: 'id_card_image', maxCount: 1 },
  { name: 'bookbank_image', maxCount: 1 }
]), async (req, res) => {
  const { owner_id, name, description, category_id, address, latitude, longitude, bank_name, bank_account } = req.body;
  
  if (!owner_id || !name || !address) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  // รับค่ารูปภาพจาก req.files (ถ้ามีอัปโหลดเข้ามา) 
  // หรือถ้าส่งเป็น URL เก่ามาใน req.body (fallback)
  let id_card_image = req.body.id_card_image || null;
  if (req.files && req.files['id_card_image']) {
    id_card_image = `/uploads/${req.files['id_card_image'][0].filename}`;
  }

  let bookbank_image = req.body.bookbank_image || null;
  if (req.files && req.files['bookbank_image']) {
    bookbank_image = `/uploads/${req.files['bookbank_image'][0].filename}`;
  }

  try {
    const [check] = await db.execute('SELECT * FROM shops WHERE owner_id = ?', [owner_id]);
    
    if (check.length > 0) {
      if (check[0].status === 'rejected') {
        await db.execute(
          `UPDATE shops SET name=?, description=?, category_id=?, address=?, latitude=?, longitude=?, bank_name=?, bank_account=?, id_card_image=?, bookbank_image=?, status='pending' WHERE owner_id=?`,
          [name, description || null, category_id || null, address, latitude || null, longitude || null, bank_name || null, bank_account || null, id_card_image, bookbank_image, owner_id]
        );
        return res.json({ success: true, message: 'ส่งข้อมูลสมัครใหม่สำเร็จ รอการตรวจสอบ', shop_id: check[0].shop_id });
      } else {
        return res.status(400).json({ success: false, message: 'คุณมีร้านค้าอยู่แล้ว' });
      }
    }

    const [result] = await db.execute(
      `INSERT INTO shops (owner_id, name, description, category_id, address, latitude, longitude, bank_name, bank_account, id_card_image, bookbank_image, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`, 
      [owner_id, name, description || null, category_id || null, address, latitude || null, longitude || null, bank_name || null, bank_account || null, id_card_image, bookbank_image]
    );

    res.json({ success: true, message: 'สมัครร้านค้าสำเร็จ รอการตรวจสอบ', shop_id: result.insertId });
  } catch (error) {
    console.error('Register Shop Error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์', error: error.message });
  }
});

app.get('/api/shops/check-pending/:userId', async (req, res) => {
  try {
    const [shops] = await db.execute('SELECT status FROM shops WHERE owner_id = ? AND status = "pending"', [req.params.userId]);
    if (shops.length > 0) {
      res.json({ success: true, isPending: true });
    } else {
      res.json({ success: true, isPending: false });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/shops/nearby', async (req, res) => {
  try {
    const [shops] = await db.execute('SELECT shop_id, name, image_url, rating, distance, tag1, tag2, IFNULL(is_open, 1) AS is_open FROM shops WHERE status = "approved" ORDER BY shop_id ASC LIMIT 10');
    res.json(shops);
  } catch (error) {
    console.error('API /api/shops/nearby error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/shops/:shopId (Shop Profile)
app.get('/api/shops/:shopId', async (req, res) => {
  const { shopId } = req.params;
  try {
    const [rows] = await db.execute(`
      SELECT 
        s.*, 
        IFNULL(s.is_open, 1) AS is_open,
        u.full_name AS owner_name, 
        u.phone AS owner_phone 
      FROM shops s 
      LEFT JOIN users u ON s.owner_id = u.user_id 
      WHERE s.shop_id = ?
    `, [shopId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }
    
    res.json({ success: true, shop: rows[0] });
  } catch (error) {
    console.error(`❌ GET /api/shops/${shopId} error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.get('/api/shops/:shopId/stats', async (req, res) => {
  const { shopId } = req.params;
  try {
    const [salesRow] = await db.execute("SELECT SUM(total_amount) AS total_revenue, COUNT(*) AS total_orders FROM orders WHERE shop_id = ? AND order_status IN ('paid', 'completed')", [shopId]);
    const [pendingRow] = await db.execute("SELECT COUNT(*) AS pending_orders FROM orders WHERE shop_id = ? AND order_status IN ('pending', 'preparing')", [shopId]);
    const [todayRow] = await db.execute("SELECT SUM(total_amount) AS today_revenue FROM orders WHERE shop_id = ? AND order_status IN ('paid', 'completed') AND DATE(created_at) = CURDATE()", [shopId]);
    const [productsRow] = await db.execute(


      `SELECT COUNT(*) AS total_products FROM products WHERE shop_id = ?`,
      [shopId]
    );

    // 5. ยอดเงินคงเหลือใน Wallet
    const [walletRow] = await db.execute(
      `SELECT balance FROM shop_wallets WHERE shop_id = ?`,
      [shopId]
    );
    const balance = walletRow.length > 0 ? parseFloat(walletRow[0].balance) : 0;

    res.json({
      success: true,
      stats: {
        total_revenue: parseFloat(salesRow[0].total_revenue) || 0,
        total_orders: salesRow[0].total_orders || 0,
        pending_orders: pendingRow[0].pending_orders || 0,
        today_revenue: parseFloat(todayRow[0].today_revenue) || 0,
        total_products: productsRow[0].total_products || 0,
        balance: balance
      }
    });
  } catch (error) {
    console.error(`❌ GET /api/shops/${shopId}/stats error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ดึงรายการสินค้าทั้งหมดของร้าน
app.get('/api/shops/:shopId/products', async (req, res) => {
  const { shopId } = req.params;
  try {
    const [products] = await db.execute(`
      SELECT 
        p.*, 
        c.name AS category_name, 
        c.icon_name AS category_icon
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE p.shop_id = ?
      ORDER BY p.deal_end_time IS NULL ASC, p.deal_end_time ASC, p.product_id DESC
    `, [shopId]);

    const formattedProducts = products.map(p => {
      const rawExpires = p.deal_end_time;
      const formattedExpiresAt = rawExpires ? new Date(rawExpires).toISOString() : null;
      return {
        ...p,
        deal_end_time: formattedExpiresAt,
        expires_at: formattedExpiresAt
      };
    });

    res.json({ success: true, products: formattedProducts });
  } catch (error) {
    console.error(`❌ GET /api/shops/${shopId}/products error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ดึงข้อมูลสินค้ารายชิ้น (สำหรับฟอร์มแก้ไข)
app.get('/api/shops/:shopId/products/:productId', async (req, res) => {
  const { shopId, productId } = req.params;
  try {
    const [products] = await db.execute(
      'SELECT * FROM products WHERE product_id = ? AND shop_id = ?',
      [productId, shopId]
    );

    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบสินค้า' });
    }

    const product = products[0];
    const rawExpires = product.deal_end_time;
    const formattedExpiresAt = rawExpires ? new Date(rawExpires).toISOString() : null;

    res.json({
      success: true,
      product: {
        ...product,
        deal_end_time: formattedExpiresAt
      }
    });
  } catch (error) {
    console.error(`❌ GET /api/shops/${shopId}/products/${productId} error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// เพิ่มสินค้าใหม่
app.post('/api/shops/:shopId/products', upload.single('image'), async (req, res) => {
  const { shopId } = req.params;
  const {
    category_id,
    name,
    original_price,
    discount_price,
    discount_percent,
    expiry_text,
    image_url,
    description,
    freshness,
    shipping_type,
    deal_end_time,
    stock_quantity,
    is_auction,
    expiry_time
  } = req.body;

  if (!name || original_price === undefined || discount_price === undefined) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อสินค้า และราคาให้ครบถ้วน' });
  }

  // คำนวณ % ส่วนลดหากไม่ได้ส่งมา
  let calculatedDiscountPercent = discount_percent;
  if (!calculatedDiscountPercent && original_price > 0 && discount_price >= 0) {
    calculatedDiscountPercent = Math.round(((original_price - discount_price) / original_price) * 100);
  }

  // แปลงรูปแบบเวลา deal_end_time ถ้ามี
  let formattedDealEndTime = deal_end_time ? new Date(new Date(deal_end_time).getTime() - new Date().getTimezoneOffset()*60000).toISOString().slice(0, 19).replace('T', ' ') : null;
  let formattedExpiryTime = expiry_time ? new Date(new Date(expiry_time).getTime() - new Date().getTimezoneOffset()*60000).toISOString().slice(0, 19).replace('T', ' ') : null;

  try {
    const [result] = await db.execute(
      `INSERT INTO products (
        shop_id, category_id, name, original_price, discount_price, 
        discount_percent, expiry_text, image_url, description, 
        freshness, shipping_type, deal_end_time,
        stock_quantity, is_auction, expiry_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shopId,
        category_id || 1,
        name,
        original_price || 0,
        discount_price || 0,
        calculatedDiscountPercent || 0,
        expiry_text || 'หมดอายุในวันนี้',
        req.file ? `data:${req.file.mimetype};base64,${fs.readFileSync(req.file.path).toString('base64')}` : (image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'),
        description || '',
        freshness || 'ทำสดใหม่ทุกเช้า',
        shipping_type || 'ควบคุมอุณหภูมิ',
        formattedDealEndTime,
        stock_quantity || 0,
        (is_auction === '1' || is_auction === 'true' || is_auction === 1) ? 1 : 0,
        formattedExpiryTime
      ]
    );

    if (is_auction === '1' || is_auction === 'true' || is_auction === 1) {
      const [shops] = await db.execute('SELECT name FROM shops WHERE shop_id = ?', [shopId]);
      const shopName = shops.length > 0 ? shops[0].name : 'Unknown Shop';
      
      await db.execute(`
        INSERT INTO auctions (
          title, description, image_url, shop_id, shop_name, 
          start_price, current_bid, min_increment, end_time, 
          auction_status, original_price, discount_percent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `, [
        name,
        description || '',
        req.file ? `data:${req.file.mimetype};base64,${fs.readFileSync(req.file.path).toString('base64')}` : (image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'),
        shopId,
        shopName,
        Math.floor((discount_price || original_price || 0) * 0.3),
        Math.floor((discount_price || original_price || 0) * 0.3),
        10,
        new Date(Date.now() + 30*60*1000 - new Date().getTimezoneOffset()*60000).toISOString().slice(0, 19).replace('T', ' '),
        original_price || 0,
        calculatedDiscountPercent || 0
      ]);
    }

    clearCache('home-data');
    clearCache('auctions');

    res.status(201).json({
      success: true,
      message: 'เพิ่มสินค้าสำเร็จ',
      product_id: result.insertId
    });
  } catch (error) {
    console.error(`❌ POST /api/shops/${shopId}/products error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// แก้ไขสินค้าเดิม (เปลี่ยนเป็น POST เพราะ axios put FormData ใน React Native มีปัญหาบ่อย)
app.post('/api/shops/:shopId/products/:productId', upload.single('image'), async (req, res) => {
  const { shopId, productId } = req.params;
  const {
    category_id,
    name,
    original_price,
    discount_price,
    discount_percent,
    expiry_text,
    image_url,
    description,
    freshness,
    shipping_type,
    deal_end_time,
    stock_quantity,
    is_auction,
    expiry_time
  } = req.body;

  let calculatedDiscountPercent = discount_percent;
  if (!calculatedDiscountPercent && original_price > 0 && discount_price >= 0) {
    calculatedDiscountPercent = Math.round(((original_price - discount_price) / original_price) * 100);
  }

  let formattedDealEndTime = deal_end_time ? new Date(new Date(deal_end_time).getTime() - new Date().getTimezoneOffset()*60000).toISOString().slice(0, 19).replace('T', ' ') : null;
  let formattedExpiryTime = expiry_time ? new Date(new Date(expiry_time).getTime() - new Date().getTimezoneOffset()*60000).toISOString().slice(0, 19).replace('T', ' ') : null;

  try {
    await db.execute(
      `UPDATE products SET
        category_id = COALESCE(?, category_id),
        name = COALESCE(?, name),
        original_price = COALESCE(?, original_price),
        discount_price = COALESCE(?, discount_price),
        discount_percent = COALESCE(?, discount_percent),
        expiry_text = COALESCE(?, expiry_text),
        image_url = COALESCE(?, image_url),
        description = COALESCE(?, description),
        freshness = COALESCE(?, freshness),
        shipping_type = COALESCE(?, shipping_type),
        deal_end_time = COALESCE(?, deal_end_time),
        stock_quantity = COALESCE(?, stock_quantity),
        is_auction = COALESCE(?, is_auction),
        expiry_time = COALESCE(?, expiry_time)
      WHERE product_id = ? AND shop_id = ?`,
      [
        category_id ?? null,
        name ?? null,
        original_price ?? null,
        discount_price ?? null,
        calculatedDiscountPercent ?? null,
        expiry_text ?? null,
        req.file ? `data:${req.file.mimetype};base64,${fs.readFileSync(req.file.path).toString('base64')}` : (image_url ?? null),
        description ?? null,
        freshness ?? null,
        shipping_type ?? null,
        formattedDealEndTime ?? null,
        stock_quantity ?? null,
        is_auction !== undefined ? (is_auction === 'true' || is_auction === '1' || is_auction === 1 ? 1 : 0) : null,
        formattedExpiryTime ?? null,
        productId,
        shopId
      ]
    );

    const [updatedProducts] = await db.execute('SELECT * FROM products WHERE product_id = ?', [productId]);
    if (updatedProducts.length > 0) {
      const product = updatedProducts[0];
      if (product.is_auction === 1) {
        const [existingAuctions] = await db.execute('SELECT auction_id FROM auctions WHERE shop_id = ? AND title = ? AND auction_status = \'active\'', [shopId, product.name]);
        if (existingAuctions.length === 0) {
          const [shops] = await db.execute('SELECT name FROM shops WHERE shop_id = ?', [shopId]);
          const shopName = shops.length > 0 ? shops[0].name : 'Unknown Shop';
          await db.execute(`INSERT INTO auctions (title, description, image_url, shop_id, shop_name, start_price, current_bid, min_increment, end_time, auction_status, original_price, discount_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`, [product.name, product.description || '', product.image_url || '', shopId, shopName, Math.floor((product.discount_price || product.original_price || 0) * 0.3), Math.floor((product.discount_price || product.original_price || 0) * 0.3), 10, new Date(Date.now() + 30*60*1000 - new Date().getTimezoneOffset()*60000).toISOString().slice(0, 19).replace('T', ' '), product.original_price || 0, product.discount_percent || 0]);
        }
      }
    }

    clearCache('home-data');
    clearCache('auctions');

    res.json({ success: true, message: 'แก้ไขข้อมูลสินค้าสำเร็จ' });
  } catch (error) {
    console.error(`❌ POST /api/shops/${shopId}/products/${productId} error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ลบสินค้า
app.delete('/api/shops/:shopId/products/:productId', async (req, res) => {
  const { shopId, productId } = req.params;
  try {
    const [products] = await db.execute('SELECT name FROM products WHERE product_id = ? AND shop_id = ?', [productId, shopId]);
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบสินค้า หรือไม่มีสิทธิ์ลบสินค้านี้' });
    }
    
    const productName = products[0].name;

    const [result] = await db.execute(
      'DELETE FROM products WHERE product_id = ? AND shop_id = ?',
      [productId, shopId]
    );

    if (result.affectedRows > 0) {
      // ยกเลิกประมูลที่เกี่ยวข้องทันทีเมื่อลบสินค้า
      await db.execute(
        'UPDATE auctions SET auction_status = ? WHERE shop_id = ? AND title = ? AND auction_status = ?',
        ['cancelled', shopId, productName, 'active']
      );
    }

    clearCache('home-data');
    clearCache('auctions');

    res.json({ success: true, message: 'ลบสินค้าเรียบร้อยแล้ว' });
  } catch (error) {
    console.error(`❌ DELETE /api/shops/${shopId}/products/${productId} error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ดึงรายการออเดอร์เข้าของร้านค้า (Incoming Orders)
app.get('/api/shops/:shopId/orders', async (req, res) => {
  const { shopId } = req.params;
  const { status } = req.query;

  try {
    let query = `
      SELECT DISTINCT
        o.*,
        u.full_name AS customer_name,
        u.phone AS customer_phone,
        u.email AS customer_email,
        d.status AS delivery_status,
        d.pickup_proofs,
        d.pickup_proof_image,
        d.proof_image AS delivery_proof_image,
        d.proof_image,
        d.pickup_at,
        d.completed_at AS delivery_completed_at,
        u_rider.full_name AS rider_name,
        u_rider.phone AS rider_phone,
        r.vehicle_plate AS rider_vehicle_plate
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.user_id
      LEFT JOIN deliveries d ON o.order_id = d.order_id
      LEFT JOIN riders r ON (o.rider_id = r.rider_id OR d.rider_id = r.rider_id)
      LEFT JOIN users u_rider ON r.user_id = u_rider.user_id
      WHERE (o.shop_id = ? OR o.order_id IN (
        SELECT DISTINCT oi.order_id 
        FROM order_items oi 
        LEFT JOIN products p ON oi.product_id = p.product_id 
        WHERE (oi.shop_id = ? OR p.shop_id = ?)
      ))
    `;
    const params = [shopId, shopId, shopId];

    if (status && status !== 'all') {
      query += ` AND o.order_status = ?`;
      params.push(status);
    }

    query += ` ORDER BY o.created_at DESC`;

    const [orders] = await db.execute(query, params);

    // Batch fetch all items in 1 query
    const orderIds = orders.map(o => o.order_id);
    let itemsByOrderId = {};
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      const [allItems] = await db.execute(
        `SELECT oi.*, p.name AS db_product_name, p.image_url AS product_image, p.shop_id AS product_shop_id,
                COALESCE(s_p.name, s_oi.name, (SELECT name FROM shops WHERE shop_id = p.shop_id), (SELECT name FROM shops WHERE shop_id = oi.shop_id), '') AS item_shop_name
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.product_id
         LEFT JOIN shops s_p ON p.shop_id = s_p.shop_id
         LEFT JOIN shops s_oi ON oi.shop_id = s_oi.shop_id
         WHERE oi.order_id IN (${placeholders})`,
        orderIds
      );
      allItems.forEach(item => {
        if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
        itemsByOrderId[item.order_id].push(item);
      });
    }

    const formattedOrders = orders.map(order => {
      const allOrderItems = itemsByOrderId[order.order_id] || [];
      const myShopItems = allOrderItems.filter(item => 
        Number(item.product_shop_id || item.shop_id) === Number(shopId) || 
        (!item.shop_id && !item.product_shop_id && Number(order.shop_id) === Number(shopId))
      );
      const itemsToDisplay = myShopItems.length > 0 ? myShopItems : allOrderItems;

      // Calculate isolated seller subtotal & total
      const myShopSubtotal = itemsToDisplay.reduce((acc, it) => acc + (parseFloat(it.price || 0) * (it.quantity || 1)), 0);

      let shopPickupProof = null;
      if (order.pickup_proofs) {
        try {
          const proofs = typeof order.pickup_proofs === 'string' ? JSON.parse(order.pickup_proofs) : order.pickup_proofs;
          if (proofs && proofs[String(shopId)]) {
            shopPickupProof = proofs[String(shopId)].proof_image || null;
          }
        } catch(e) {}
      } else if (Number(order.shop_id) === Number(shopId)) {
        shopPickupProof = order.pickup_proof_image || null;
      }

      // Per-shop status
      let parsedShopStatuses = {};
      if (order.shop_statuses) {
        try { parsedShopStatuses = typeof order.shop_statuses === 'string' ? JSON.parse(order.shop_statuses) : order.shop_statuses; } catch(e) {}
      }

      let effectiveShopStatus = parsedShopStatuses[String(shopId)];
      if (!effectiveShopStatus) {
        effectiveShopStatus = order.order_status;
      }

      if (['delivering', 'delivered', 'shipped', 'completed', 'cancelled'].includes(order.order_status)) {
        effectiveShopStatus = order.order_status;
      }

      return {
        ...order,
        subtotal: myShopSubtotal,
        total_amount: myShopSubtotal,
        order_status: effectiveShopStatus,
        pickup_proof_image: shopPickupProof,
        items: itemsToDisplay.map(item => ({
          ...item,
          product_name: item.product_name || item.db_product_name || 'สินค้า',
          shop_name: item.item_shop_name || order.shop_name || 'ร้านค้า'
        })),
        all_items: allOrderItems.map(item => ({
          ...item,
          product_name: item.product_name || item.db_product_name || 'สินค้า',
          shop_name: item.item_shop_name || order.shop_name || 'ร้านค้า'
        })),
        all_items_count: allOrderItems.length,
        my_items_count: myShopItems.length
      };
    });

    res.json({ success: true, orders: formattedOrders });
  } catch (error) {
    console.error(`❌ GET /api/shops/${shopId}/orders error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// อัปเดตสถานะคำสั่งซื้อ (Order Status Update)
app.put('/api/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { order_status, shop_id } = req.body;

  const validStatuses = ['pending', 'paid', 'preparing', 'ready', 'finding_rider', 'delivering', 'shipped', 'completed', 'cancelled'];
  if (!validStatuses.includes(order_status)) {
    return res.status(400).json({ success: false, message: 'สถานะคำสั่งซื้อไม่ถูกต้อง' });
  }

  try {
    const [existingOrders] = await db.execute('SELECT shop_statuses, order_status, shop_id, user_id FROM orders WHERE order_id = ?', [orderId]);
    let currentShopStatuses = {};
    if (existingOrders.length > 0 && existingOrders[0].shop_statuses) {
      try { currentShopStatuses = typeof existingOrders[0].shop_statuses === 'string' ? JSON.parse(existingOrders[0].shop_statuses) : existingOrders[0].shop_statuses; } catch(e) {}
    }

    if (shop_id) {
      currentShopStatuses[String(shop_id)] = order_status;
    }

    // Find all distinct shop_ids in this order
    const [itemShops] = await db.execute('SELECT DISTINCT shop_id FROM order_items WHERE order_id = ? AND shop_id IS NOT NULL', [orderId]);
    const distinctShopIds = itemShops.map(s => String(s.shop_id));
    if (distinctShopIds.length === 0 && existingOrders.length > 0 && existingOrders[0].shop_id) {
      distinctShopIds.push(String(existingOrders[0].shop_id));
    }

    // Check if all shops are ready
    const allShopsReady = distinctShopIds.length > 0 && distinctShopIds.every(sid => currentShopStatuses[sid] === 'ready');
    const newGlobalStatus = allShopsReady ? 'ready' : (order_status === 'preparing' ? 'preparing' : (distinctShopIds.length <= 1 ? order_status : existingOrders[0]?.order_status || 'preparing'));

    await db.execute(
      'UPDATE orders SET order_status = ?, shop_statuses = ? WHERE order_id = ?',
      [newGlobalStatus, JSON.stringify(currentShopStatuses), orderId]
    );

    // ส่งการแจ้งเตือนไปยังผู้ซื้อ (Buyer Notification)
    try {
      const [orderRows] = await db.execute('SELECT user_id, shop_id FROM orders WHERE order_id = ?', [orderId]);
      if (orderRows.length > 0) {
        const userId = orderRows[0].user_id;
        let notifTitle = '';
        let notifMsg = '';

        if (order_status === 'preparing') {
          notifTitle = `👨‍🍳 ร้านค้ารับออเดอร์แล้ว (#${orderId})`;
          notifMsg = 'ร้านค้ากำลังเริ่มจัดเตรียมอาหาร/สินค้าของคุณแล้ว';
        } else if (order_status === 'ready') {
          notifTitle = `📦 สินค้าจัดเตรียมเสร็จแล้ว (#${orderId})`;
          notifMsg = 'สินค้าของคุณจัดเตรียมเสร็จเรียบร้อยแล้ว พร้อมส่งมอบ';
        } else if (order_status === 'finding_rider') {
          notifTitle = `🔍 กำลังค้นหาไรเดอร์ (#${orderId})`;
          notifMsg = 'ระบบกำลังค้นหาไรเดอร์เพื่อจัดส่งสินค้าของคุณ';
        } else if (order_status === 'delivering' || order_status === 'shipped') {
          notifTitle = `🛵 สินค้ากำลังจัดส่ง (#${orderId})`;
          notifMsg = 'สินค้าของคุณอยู่ระหว่างการจัดส่งไปยังที่อยู่ของคุณ';
        } else if (order_status === 'completed') {
          notifTitle = `✅ คำสั่งซื้อสำเร็จ (#${orderId})`;
          notifMsg = 'คำสั่งซื้อของคุณเสร็จสมบูรณ์เรียบร้อยแล้ว ขอบคุณที่ใช้บริการ SmartDeal';
        } else if (order_status === 'cancelled') {
          notifTitle = `❌ คำสั่งซื้อถูกยกเลิก (#${orderId})`;
          notifMsg = 'คำสั่งซื้อของคุณถูกยกเลิกแล้ว';
        }

        if (notifTitle && userId) {
          await db.execute(
            'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
            [userId, notifTitle, notifMsg, String(orderId)]
          );
        }
      }
    } catch(notifErr) {
      console.error('Error inserting order status notification:', notifErr.message);
    }

    res.json({ success: true, message: `อัปเดตสถานะออเดอร์เป็น ${order_status} สำเร็จ` });
  } catch (error) {
    console.error(`❌ PUT /api/orders/${orderId}/status error:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// SEARCH API
// ==========================================
app.get('/api/search', async (req, res) => {
  const { keyword } = req.query;
  if (!keyword) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุคำค้นหา' });
  }

  try {
    const searchParam = `%${keyword}%`;

    // 1. ค้นหาร้านค้า
    const [shops] = await db.execute(
      'SELECT shop_id, name, image_url, distance, rating FROM shops WHERE status = "approved" AND name LIKE ?',
      [searchParam]
    );

    // 2. ค้นหาสินค้า
    const [products] = await db.execute(
      `SELECT p.*, s.name AS shop_name 
       FROM products p 
       LEFT JOIN shops s ON p.shop_id = s.shop_id 
       WHERE p.name LIKE ? AND s.status = 'approved' AND p.is_auction = 0 AND (p.deal_end_time > UTC_TIMESTAMP() OR p.deal_end_time IS NULL) AND p.stock_quantity > 0 ORDER BY p.deal_end_time IS NULL ASC, p.deal_end_time ASC`,
      [searchParam]
    );

    res.json({
      success: true,
      shops,
      products
    });
  } catch (error) {
    console.error('Search API Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ADMIN API
// ==========================================

// 1. API จัดการผู้ใช้ (User Management)
app.get('/api/admin/users', async (req, res) => {
  try {
    const [results] = await db.execute(
      `SELECT u.user_id, u.full_name, u.email, u.phone, u.role, u.status, u.avatar_url, u.created_at, 
      CASE 
        WHEN u.role = 'seller' THEN (SELECT COUNT(*) FROM orders o WHERE o.shop_id = (SELECT shop_id FROM shops s WHERE s.owner_id = u.user_id LIMIT 1) AND o.order_status = 'delivered')
        WHEN u.role = 'driver' THEN (SELECT COUNT(*) FROM deliveries d JOIN riders r ON d.rider_id = r.rider_id WHERE r.user_id = u.user_id AND d.status = 'delivered')
        WHEN u.role = 'buyer'  THEN (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.user_id)
        ELSE 0
      END as performance_score
      FROM users u 
      WHERE 
          (u.role = 'buyer') OR
          (u.role = 'seller' AND EXISTS (SELECT 1 FROM shops s WHERE s.owner_id = u.user_id AND s.status = 'approved')) OR
          (u.role = 'driver' AND EXISTS (SELECT 1 FROM riders r WHERE r.user_id = u.user_id AND r.status = 'approved')) OR
          (u.role NOT IN ('buyer', 'seller', 'driver'))
        ORDER BY u.created_at DESC`);
    res.json(results);
  } catch (error) {
    console.error('API /api/admin/users Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/admin/users/:id/status', async (req, res) => {
  const { status } = req.body;
  try {
    const [result] = await db.execute(
      `UPDATE users SET status = ? WHERE user_id = ?`,
      [status, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    }
    res.json({ success: true, message: 'อัปเดตสถานะสำเร็จ' });
  } catch (error) {
    console.error('API /api/admin/users/:id/status Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 2. API อนุมัติร้านใหม่ (Shop Approvals)
app.get('/api/admin/shops/pending', async (req, res) => {
  try {
    const [results] = await db.execute(`
      SELECT shops.shop_id, shops.name AS shop_name, users.full_name AS owner_name, users.email AS owner_email, users.phone AS owner_phone, shops.created_at, shops.id_card_image, shops.bookbank_image, shops.bank_name, shops.bank_account, shops.address, shops.description, shops.latitude, shops.longitude FROM shops LEFT JOIN users ON shops.owner_id = users.user_id WHERE shops.status = 'pending' ORDER BY shops.created_at DESC
    `);
    res.json(results);
  } catch (error) {
    console.error('API /api/admin/shops/pending Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/admin/shops/:id/approve', async (req, res) => {
  try {
    const shopId = req.params.id;
    const [result] = await db.execute(`UPDATE shops SET status = "approved" WHERE shop_id = ?`, [shopId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'ไม่พบร้านค้า' });
    const [shop] = await db.execute(`SELECT owner_id FROM shops WHERE shop_id = ?`, [shopId]);
    if (shop.length > 0) {
      await db.execute(`UPDATE users SET role = "seller" WHERE user_id = ?`, [shop[0].owner_id]);
    }
    res.json({ success: true, message: 'อนุมัติร้านค้าเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('API /api/admin/shops/:id/approve Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});
app.put('/api/admin/shops/:id/approve', async (req, res) => {
  try {
    const [result] = await db.execute(`UPDATE shops SET status = "approved" WHERE shop_id = ?`, [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'ไม่พบร้านค้า' });
    res.json({ success: true, message: 'อนุมัติร้านค้าเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('API /api/admin/shops/:id/approve Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/admin/shops/:id/reject', async (req, res) => {
  const { reason } = req.body;
  try {
    const [result] = await db.execute('UPDATE shops SET status = "rejected", reject_reason = ? WHERE shop_id = ?', [reason || null, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'ไม่พบร้านค้า' });

    const [shopData] = await db.execute('SELECT owner_id FROM shops WHERE shop_id = ?', [req.params.id]);
    if (shopData.length > 0) {
      const ownerId = shopData[0].owner_id;
      await db.execute('INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (?, ?, ?, ?, ?)', 
        [ownerId, 'คำขอเปิดร้านไม่ผ่านการอนุมัติ', `เหตุผล: ${reason || 'ไม่ระบุ'}`, 'shop_rejected', req.params.id]);
      
      const [userRows] = await db.execute('SELECT push_token FROM users WHERE user_id = ?', [ownerId]);
      if (userRows.length > 0 && userRows[0].push_token && Expo.isExpoPushToken(userRows[0].push_token)) {
        expo.sendPushNotificationsAsync([{
          to: userRows[0].push_token,
          sound: 'default',
          title: 'คำขอของคุณไม่ผ่านการอนุมัติ ❌',
          body: `เหตุผล: ${reason || 'ไม่ระบุ'}`,
          data: { type: 'REGISTRATION_REJECTED', status: 'rejected', reason: reason }
        }]).catch(console.error);
      }
    }

    res.json({ success: true, message: 'ปฏิเสธร้านค้าสำเร็จ' });
  } catch (error) {
    console.error('API /api/admin/shops/:id/reject Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 3. API จัดการร้านค้า (Shop Management)
app.get('/api/admin/shops', async (req, res) => {
  try {
    const [results] = await db.execute(`
      SELECT s.shop_id, s.name, s.rating, s.address, s.status, s.created_at, COUNT(p.product_id) AS product_count 
      FROM shops s
      LEFT JOIN products p ON s.shop_id = p.shop_id
      WHERE s.status = 'approved' OR s.status = 'pending' 
      GROUP BY s.shop_id
      ORDER BY s.created_at DESC
    `);
    res.json(results);
  } catch (error) {
    console.error('API /api/admin/shops Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/admin/shops/:id/insights', async (req, res) => {
  const shopId = req.params.id;
  try {
    const [shopInfo] = await db.execute('SELECT s.*, COALESCE(ROUND((SELECT AVG(r.rating) FROM reviews r WHERE r.shop_id = s.shop_id), 1), s.rating, 0.0) AS rating, u.full_name AS owner_name, u.phone AS owner_phone, u.email AS owner_email FROM shops s LEFT JOIN users u ON s.owner_id = u.user_id WHERE s.shop_id = ?', [shopId]);
    
    if (shopInfo.length === 0) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const [salesKpi] = await db.execute('SELECT COUNT(order_id) AS total_orders, SUM(total_amount) AS total_revenue FROM orders WHERE shop_id = ? AND order_status IN (\'completed\', \'paid\', \'delivered\')', [shopId]);
    
    const [products] = await db.execute('SELECT product_id, name, description, original_price, discount_price AS price, stock_quantity AS stock, image_url, expiry_time AS expiration_date, category_id FROM products WHERE shop_id = ? ORDER BY product_id DESC LIMIT 10', [shopId]);
    
    const [weeklyChart] = await db.execute('SELECT DATE_FORMAT(created_at, \'%d %b\') AS date, SUM(total_amount) AS total FROM orders WHERE shop_id = ? AND order_status IN (\'completed\', \'paid\', \'delivered\') AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY DATE(created_at) ORDER BY DATE(created_at)', [shopId]);

    res.json({
      shop: shopInfo[0],
      kpi: {
        total_orders: salesKpi[0].total_orders || 0,
        total_revenue: salesKpi[0].total_revenue || 0
      },
      products: products || [],
      weekly_sales: weeklyChart || []
    });
  } catch (error) {
    console.error('API /api/admin/shops/:id/insights Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/admin/shops/:id/suspend', async (req, res) => {
  try {
    const [result] = await db.execute('UPDATE shops SET status = "suspended" WHERE shop_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Shop not found' });
    res.json({ success: true, message: 'Shop suspended successfully' });
  } catch (error) {
    console.error('API /api/admin/shops/:id/suspend Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Dashboard Stats
app.get('/api/admin/dashboard', async (req, res) => {
  try {
    const [[{ total_sales }]] = await db.execute(`SELECT SUM(total_amount) AS total_sales FROM orders WHERE order_status IN ('completed', 'paid', 'delivered')`);
    const [[{ total_orders }]] = await db.execute(`SELECT COUNT(*) AS total_orders FROM orders`);
    const [[{ total_users }]] = await db.execute(`SELECT COUNT(*) AS total_users FROM users`);
    const [[{ total_shops }]] = await db.execute(`SELECT COUNT(*) AS total_shops FROM shops`);
    
    const [top_shops] = await db.execute(`SELECT shops.name AS shop_name, SUM(orders.total_amount) AS total_sales FROM orders JOIN shops ON orders.shop_id = shops.shop_id GROUP BY shops.shop_id ORDER BY total_sales DESC LIMIT 5`);
    
    const [recent_orders] = await db.execute(`SELECT orders.order_id, COALESCE((SELECT GROUP_CONCAT(DISTINCT s.name SEPARATOR ', ') FROM order_items oi LEFT JOIN products p ON oi.product_id = p.product_id JOIN shops s ON s.shop_id = COALESCE(oi.shop_id, p.shop_id) WHERE oi.order_id = orders.order_id), shops_fallback.name) as shop_name, orders.total_amount FROM orders LEFT JOIN shops shops_fallback ON orders.shop_id = shops_fallback.shop_id ORDER BY orders.created_at DESC LIMIT 5`);

    
    const period = req.query.period || '30';
    let salesTrendQuery = '';
    
    if (period === '7') {
      salesTrendQuery = `SELECT DATE_FORMAT(created_at, '%d %b') AS name, SUM(total_amount) AS total FROM orders WHERE order_status IN ('completed', 'paid', 'delivered') AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY DATE(created_at) ORDER BY DATE(created_at)`;
    } else if (period === '365') {
      salesTrendQuery = `SELECT DATE_FORMAT(created_at, '%b %Y') AS name, SUM(total_amount) AS total FROM orders WHERE order_status IN ('completed', 'paid', 'delivered') AND created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR) GROUP BY MONTH(created_at), YEAR(created_at) ORDER BY YEAR(created_at), MONTH(created_at)`;
    } else {
      salesTrendQuery = `SELECT DATE_FORMAT(created_at, '%d %b') AS name, SUM(total_amount) AS total FROM orders WHERE order_status IN ('completed', 'paid', 'delivered') AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY DATE(created_at) ORDER BY DATE(created_at)`;
    }
    
    const [sales_trend] = await db.execute(salesTrendQuery);

    
    const [category_stats] = await db.execute(`SELECT categories.name AS name, COUNT(shops.shop_id) AS value FROM shops JOIN categories ON shops.category_id = categories.category_id GROUP BY categories.name`);

    res.json({
      stats: {
        total_sales: total_sales || 0,
        total_orders: total_orders || 0,
        total_users: total_users || 0,
        total_shops: total_shops || 0
      },
      top_shops: top_shops,
      recent_orders: recent_orders,
      sales_trend: sales_trend,
      category_stats: category_stats
    });
  } catch (error) {
    console.error('Admin Dashboard Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/admin/users/:id/details', async (req, res) => {
  const userId = req.params.id;
  try {
    const [user] = await db.execute(`SELECT user_id, full_name, email, phone, role, status, created_at, avatar_url FROM users WHERE user_id = ?`, [userId]);
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    let stats = { total_orders: 0, total_spent: 0, avg_order_value: 0 };
    let recent_orders = [];
    const role = user[0].role;
    
    if (role === 'buyer') {
      const [s] = await db.execute(`SELECT COUNT(order_id) AS total_orders, SUM(total_amount) AS total_spent, AVG(total_amount) AS avg_order_value FROM orders WHERE user_id = ? AND (order_status IN ('completed', 'paid', 'delivered') OR order_status = 'delivered')`, [userId]);
      stats = { total_orders: s[0].total_orders || 0, total_spent: s[0].total_spent || 0, avg_order_value: s[0].avg_order_value || 0 };
      const [ro] = await db.execute(`SELECT order_id, total_amount, order_status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`, [userId]);
      recent_orders = ro;
    } else if (role === 'seller') {
      const [shopRows] = await db.execute(`SELECT shop_id FROM shops WHERE owner_id = ? LIMIT 1`, [userId]);
      if (shopRows.length > 0) {
        const shopId = shopRows[0].shop_id;
        const [s] = await db.execute(`SELECT COUNT(order_id) AS total_orders, SUM(total_amount) AS total_spent, AVG(total_amount) AS avg_order_value FROM orders WHERE shop_id = ? AND (order_status = 'completed' OR order_status = 'delivered')`, [shopId]);
        stats = { total_orders: s[0].total_orders || 0, total_spent: s[0].total_spent || 0, avg_order_value: s[0].avg_order_value || 0 };
        const [ro] = await db.execute(`SELECT order_id, total_amount, order_status, created_at FROM orders WHERE shop_id = ? ORDER BY created_at DESC LIMIT 5`, [shopId]);
        recent_orders = ro;
      }
    } else if (role === 'driver') {
      const [riderRows] = await db.execute(`SELECT rider_id FROM riders WHERE user_id = ? LIMIT 1`, [userId]);
      if (riderRows.length > 0) {
        const riderId = riderRows[0].rider_id;
        const [s] = await db.execute(`SELECT COUNT(d.id) AS total_orders, SUM(o.delivery_fee) AS total_spent, AVG(o.delivery_fee) AS avg_order_value FROM deliveries d JOIN orders o ON d.order_id = o.order_id WHERE d.rider_id = ? AND (d.status = 'completed' OR o.order_status = 'completed')`, [riderId]);
        stats = { total_orders: s[0].total_orders || 0, total_spent: s[0].total_spent || 0, avg_order_value: s[0].avg_order_value || 0 };
        const [ro] = await db.execute(`SELECT o.order_id, o.delivery_fee as total_amount, d.status as order_status, d.completed_at as created_at FROM deliveries d JOIN orders o ON d.order_id = o.order_id WHERE d.rider_id = ? ORDER BY d.completed_at DESC LIMIT 5`, [riderId]);
        recent_orders = ro;
      }
    } else {
      // Admin or others
      const [s] = await db.execute(`SELECT COUNT(order_id) AS total_orders, SUM(total_amount) AS total_spent, AVG(total_amount) AS avg_order_value FROM orders WHERE user_id = ? AND (order_status IN ('completed', 'paid', 'delivered'))`, [userId]);
      stats = { total_orders: s[0].total_orders || 0, total_spent: s[0].total_spent || 0, avg_order_value: s[0].avg_order_value || 0 };
      const [ro] = await db.execute(`SELECT order_id, total_amount, order_status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`, [userId]);
      recent_orders = ro;
    }
    
    let addresses = [];
    try {
      const [addr] = await db.execute(`SELECT address_line, province, zip_code FROM user_addresses WHERE user_id = ? LIMIT 3`, [userId]);
      addresses = addr;
    } catch (e) {
      try {
        const [fallbackAddr] = await db.execute(`SELECT DISTINCT shipping_address AS address_line FROM orders WHERE user_id = ? AND shipping_address IS NOT NULL LIMIT 3`, [userId]);
        addresses = fallbackAddr;
      } catch (err) {}
    }

    res.json({
      user: user[0],
      stats: stats,
      recent_orders: recent_orders,
      addresses: addresses
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Database error' });
  }
});
app.get('/api/seller/dashboard/:owner_id', async (req, res) => {
  try {
    const owner_id = req.params.owner_id;
    
    // 1. Get Shop Info
    const [shopData] = await db.execute('SELECT shop_id, name, status, IFNULL(is_open, 1) AS is_open FROM shops WHERE owner_id = ?', [owner_id]);
    if (shopData.length === 0) {
      return res.json({ success: false, message: 'Shop not found' });
    }
    const shop = shopData[0];
    const shop_id = shop.shop_id;

    // 2. Get Today's Sales
    const [statsData] = await db.execute(`
      SELECT SUM(subtotal) AS today_sales, SUM(subtotal * (SELECT setting_value FROM system_settings WHERE setting_key='platform_fee_percent') / 100) AS total_gp, COUNT(order_id) AS today_orders 
      FROM orders 
      WHERE shop_id = ? AND DATE(created_at) = CURDATE() AND order_status IN ('completed', 'paid', 'delivered', 'shipped')
    `, [shop_id]);
    
    const stats = {
      today_sales: (statsData[0].today_sales || 0) - (statsData[0].total_gp || 0),
      today_orders: statsData[0].today_orders || 0
    };

    // 3. Get Recent Orders
    const [recentOrders] = await db.execute(`
      SELECT o.order_id, (o.subtotal * (1 - (SELECT setting_value FROM system_settings WHERE setting_key='platform_fee_percent') / 100)) as total_amount, o.order_status, DATE_FORMAT(o.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at, oi.product_id, COALESCE(p.image_url, (SELECT image_url FROM auctions WHERE title COLLATE utf8mb4_unicode_ci = oi.product_name COLLATE utf8mb4_unicode_ci LIMIT 1)) as image_url, COALESCE(p.name, oi.product_name) as product_name
        FROM orders o
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.product_id
      WHERE o.shop_id = ? 
      ORDER BY o.created_at DESC 
      LIMIT 5
    `, [shop_id]);

    const formattedOrders = [];
    const orderMap = new Map();
    
    recentOrders.forEach(row => {
      if (!orderMap.has(row.order_id)) {
        orderMap.set(row.order_id, {
          order_id: row.order_id,
          total_amount: row.total_amount,
          order_status: row.order_status,
          created_at: row.created_at,
          image_url: row.image_url,
          product_name: row.product_name
        });
        formattedOrders.push(orderMap.get(row.order_id));
      }
    });

    res.json({
      success: true,
      shop: shop,
      stats: stats,
      recentOrders: formattedOrders
    });
  } catch (error) {
    console.error('API /api/seller/dashboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Wallet API for Seller
app.get('/api/seller/wallet/:shop_id', async (req, res) => {
  try {
    const shop_id = req.params.shop_id;
    await db.execute('INSERT IGNORE INTO shop_wallets (shop_id, balance) VALUES (?, 0)', [shop_id]);
    const [walletData] = await db.execute('SELECT balance FROM shop_wallets WHERE shop_id = ?', [shop_id]);
    const balance = walletData[0]?.balance || 0;
    
    // ดึงยอดถอนที่รอดำเนินการ
    const [pendingWithdrawData] = await db.execute('SELECT SUM(amount) as pending_amount FROM withdrawals WHERE shop_id = ? AND status = "pending"', [shop_id]);
    const pending_withdrawal = pendingWithdrawData[0]?.pending_amount || 0;
    
    // ดึงยอดเงิน Escrow (ออเดอร์ที่จ่ายแล้ว/กำลังส่ง แต่ยังไม่กดยืนยันรับ)
    const [pendingEscrowData] = await db.execute('SELECT SUM(total_amount - delivery_fee) as pending_escrow FROM orders WHERE shop_id = ? AND order_status IN ("paid", "shipped", "pending")', [shop_id]);
    const pending_escrow = pendingEscrowData[0]?.pending_escrow || 0;

    const [orders] = await db.execute('SELECT order_id as id, amount, created_at, "sale" as type FROM wallet_transactions WHERE target_id = ? AND user_type="shop" AND type="credit" ORDER BY created_at DESC LIMIT 20', [shop_id]);
    const [withdrawals] = await db.execute('SELECT id, amount, created_at, status, "withdrawal" as type FROM withdrawals WHERE shop_id = ? ORDER BY created_at DESC LIMIT 20', [shop_id]);
    const history = [...orders, ...withdrawals].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30);
    
    // ส่งกลับไปให้แสดงผล (ใช้ pending_amount รับค่า escrow ไปเพื่อให้ frontend เดิมทำงานได้)
    res.json({ success: true, balance, pending_amount: pending_escrow, pending_withdrawal, history });
  } catch (error) {
    console.error('Wallet API Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/seller/wallet/withdraw', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { shop_id, amount } = req.body;
    if (!shop_id || !amount || amount <= 0) return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' });
    await connection.beginTransaction();
    const [wallet] = await connection.execute('SELECT balance FROM shop_wallets WHERE shop_id = ? FOR UPDATE', [shop_id]);
    const balance = parseFloat(wallet[0]?.balance || 0);
    if (balance < amount) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'ยอดเงินไม่เพียงพอ' });
    }
    await connection.execute('UPDATE shop_wallets SET balance = balance - ? WHERE shop_id = ?', [amount, shop_id]);
    await connection.execute('INSERT INTO withdrawals (shop_id, amount, status) VALUES (?, ?, "pending")', [shop_id, amount]);
    await connection.commit();
    res.json({ success: true, message: 'ส่งคำขอถอนเงินสำเร็จ' });
  } catch (error) {
    await connection.rollback();
    console.error('Withdraw API Error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

app.get('/api/admin/withdrawals', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT w.id, w.amount, w.status, w.created_at, w.user_type, 
          COALESCE(s.name, u.full_name) as shop_name, 
          COALESCE(s.bank_name, 'ยังไม่ได้ระบุ') as bank_name, 
          COALESCE(s.bank_account, u.phone) as bank_account, 
          s.bookbank_image
        FROM withdrawals w
        LEFT JOIN shops s ON w.shop_id = s.shop_id
        LEFT JOIN riders r ON w.rider_id = r.rider_id
        LEFT JOIN users u ON r.user_id = u.user_id
        WHERE w.status = "pending"
        ORDER BY w.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/withdrawals/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    
      const [wCheck] = await db.execute('SELECT * FROM withdrawals WHERE id = ? AND status = "pending"', [id]);
      if (wCheck.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบคำขอถอนเงินที่รออนุมัติ' });
      
      const wData = wCheck[0];
      const [result] = await db.execute('UPDATE withdrawals SET status = "completed", processed_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      
      if (wData.user_type === 'rider') {
        await db.execute("INSERT INTO wallet_transactions (user_type, target_id, amount, type, description) VALUES ('rider', ?, ?, 'debit', 'ถอนเงิน')", [wData.rider_id, wData.amount]);
      }
  
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ไม่พบคำขอถอนเงินที่รออนุมัติ' });
    res.json({ success: true, message: 'อนุมัติการถอนเงินสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/withdrawals/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.execute('UPDATE withdrawals SET status = "rejected", processed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = "pending"', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ไม่พบคำขอถอนเงินที่รออนุมัติ' });
    res.json({ success: true, message: 'ปฏิเสธคำขอถอนเงินสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/seller/settings/:owner_id', async (req, res) => {
  try {
    const owner_id = req.params.owner_id;
    const [rows] = await db.execute('SELECT s.shop_id, s.name, s.address, s.opening_hours, s.bank_name, s.bank_account, s.image_url, s.latitude, s.longitude, IFNULL(s.is_open, 1) AS is_open, u.full_name AS owner_name FROM shops s JOIN users u ON s.owner_id = u.user_id WHERE s.owner_id = ?', [owner_id]);
    if (rows.length === 0) return res.json({ success: false, message: 'Shop not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/seller/settings/:shop_id/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    const imageUrl = '/uploads/' + req.file.filename;
    await db.execute('UPDATE shops SET image_url = ? WHERE shop_id = ?', [imageUrl, req.params.shop_id]);
    res.json({ success: true, image_url: imageUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/seller/settings/:shop_id', async (req, res) => {
  try {
    const shop_id = req.params.shop_id;
    const { name, address, opening_hours, bank_name, bank_account, latitude, longitude, is_open } = req.body;
    try {
      await db.execute('ALTER TABLE shops ADD COLUMN is_open TINYINT(1) NOT NULL DEFAULT 1');
    } catch(e) {}
    
    await db.execute(
      'UPDATE shops SET name = ?, address = ?, opening_hours = ?, bank_name = ?, bank_account = ?, latitude = ?, longitude = ?, is_open = IFNULL(?, is_open) WHERE shop_id = ?', 
      [name, address, opening_hours, bank_name, bank_account, latitude || null, longitude || null, is_open !== undefined ? is_open : null, shop_id]
    );
    res.json({ success: true, message: 'บันทึกข้อมูลสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/seller/toggle-status/:shop_id', async (req, res) => {
  try {
    const shop_id = req.params.shop_id;
    const { is_open } = req.body;
    try {
      await db.execute('ALTER TABLE shops ADD COLUMN is_open TINYINT(1) NOT NULL DEFAULT 1');
    } catch(e) {}
    
    const newStatus = is_open ? 1 : 0;
    await db.execute('UPDATE shops SET is_open = ? WHERE shop_id = ?', [newStatus, shop_id]);
    res.json({ success: true, is_open: newStatus, message: newStatus ? 'เปิดร้านสำเร็จ' : 'ปิดร้านชั่วคราวสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// COMPLAINTS (Help Center)
// ==========================================

app.post('/api/complaints', upload.single('image'), async (req, res) => {
  const { user_id, subject, message, order_id } = req.body;
  
  if (!user_id || !subject || !message) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const imageUrl = req.file ? `data:${req.file.mimetype};base64,${fs.readFileSync(req.file.path).toString('base64')}` : null;

    const [result] = await db.execute(
      `INSERT INTO complaints (user_id, order_id, subject, message, image_url, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
      [user_id, order_id || null, subject, message, imageUrl]
    );

    res.status(201).json({ success: true, message: 'Complaint submitted successfully', complaint_id: result.insertId });
  } catch (error) {
    console.error('Error submitting complaint:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


app.get('/api/admin/migrate-shops', async (req, res) => {
  try {
    await db.execute('ALTER TABLE shops ADD COLUMN opening_time TIME DEFAULT "08:00:00", ADD COLUMN closing_time TIME DEFAULT "20:00:00"');
    res.json({ success: true, message: "Migrated successfully!" });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

app.get('/api/admin/complaints', async (req, res) => {
  try {
    const [complaints] = await db.execute(`
      SELECT c.*, DATE_FORMAT(c.created_at, '%Y-%m-%dT%T.000Z') as created_at_str, u.full_name as user_name, u.email, u.phone FROM complaints c LEFT JOIN users u ON c.user_id = u.user_id ORDER BY c.created_at DESC
    `);
    const formattedComplaints = complaints.map(c => ({ ...c, created_at: c.created_at_str || c.created_at }));
    res.json(formattedComplaints);
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.put('/api/admin/complaints/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await db.execute('UPDATE complaints SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    console.error('Error updating complaint status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 5000;

// ==========================================
// ORDER CHAT APIs
// ==========================================
app.get('/api/orders/:order_id/messages', async (req, res) => {
  const orderId = req.params.order_id;
  const target = req.query.target || req.query.channel; // 'seller' | 'rider' | 'buyer'
  const role = req.query.role; // 'seller' | 'rider' | 'buyer'
  try {
    let query = `SELECT id, order_id, sender_id, sender_type, receiver_type, message, image_url, 
                        DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z') as created_at 
                 FROM order_messages 
                 WHERE order_id = ?`;
    const params = [orderId];

    // 1. ช่องทาง: ร้านค้า ↔ ไรเดอร์ (Shop <-> Rider)
    if ((role === 'seller' && target === 'rider') || (role === 'rider' && target === 'seller')) {
      query += ' AND ((sender_type = "seller" AND receiver_type = "rider") OR (sender_type = "rider" AND receiver_type = "seller"))';
    } 
    // 2. ช่องทาง: ลูกค้า ↔ ไรเดอร์ (Customer <-> Rider)
    else if ((role === 'buyer' && target === 'rider') || (role === 'rider' && target === 'buyer') || (target === 'rider' && role !== 'seller')) {
      query += ' AND ((sender_type = "buyer" AND receiver_type = "rider") OR (sender_type = "rider" AND receiver_type = "buyer"))';
    } 
    // 3. ช่องทาง: ลูกค้า ↔ ร้านค้า (Customer <-> Shop)
    else {
      query += ' AND ((sender_type = "buyer" AND receiver_type = "seller") OR (sender_type = "seller" AND receiver_type = "buyer"))';
    }

    query += ' ORDER BY id ASC';

    const [messages] = await db.query(query, params);
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching order messages:', error);
    res.status(500).json({ success: false, message: 'ไม่สามารถดึงข้อความได้' });
  }
});

app.post('/api/orders/:order_id/messages', upload.single('image'), async (req, res) => {
  const orderId = req.params.order_id;
  const { sender_id, sender_type, message } = req.body;
  let receiver_type = req.body.receiver_type;
  
  // กำหนดผู้รับปลายทางอย่างแม่นยำ ไม่ให้ข้อความปนกัน
  if (!receiver_type || receiver_type === 'all') {
    if (sender_type === 'seller') receiver_type = 'buyer';
    else if (sender_type === 'buyer') receiver_type = 'seller';
    else if (sender_type === 'rider') receiver_type = 'buyer';
  }

  let image_url = req.body.image_url || '';
  if (req.file) {
    image_url = `/uploads/${req.file.filename}`;
  }
  
  if (!sender_id || !sender_type || (!message && !image_url)) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน (ต้องมีข้อความหรือรูปภาพ)' });
  }
  
  try {
    const [result] = await db.query(
      'INSERT INTO order_messages (order_id, sender_id, sender_type, receiver_type, message, image_url) VALUES (?, ?, ?, ?, ?, ?)',
      [orderId, sender_id, sender_type, receiver_type, message || '', image_url || null]
    );
    res.json({ 
      success: true, 
      message: 'ส่งข้อความสำเร็จ', 
      message_id: result.insertId,
      data: {
        id: result.insertId,
        order_id: orderId,
        sender_id,
        sender_type,
        receiver_type,
        message: message || '',
        image_url: image_url || null,
        created_at: new Date()
      }
    });
  } catch (error) {
    console.error('Error sending order message:', error);
    res.status(500).json({ success: false, message: 'ไม่สามารถส่งข้อความได้' });
  }
});


// ==========================================
// BANNER APIs
// ==========================================
app.get('/api/banners', async (req, res) => {
  try {
    const cachedBanners = getCache('banners');
    if (cachedBanners) {
      return res.json(cachedBanners);
    }

    const [banners] = await db.query('SELECT * FROM banners WHERE is_active = true ORDER BY id ASC');
    const bannersPayload = { success: true, banners };
    setCache('banners', bannersPayload, 120); // แคชแบนเนอร์ 2 นาที
    res.json(bannersPayload);
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({ success: false, message: 'ไม่สามารถดึงแบนเนอร์ได้' });
  }
});


// ==========================================
// ADMIN BANNER APIs
// ==========================================
app.get('/api/admin/banners', async (req, res) => {
  try {
    const [banners] = await db.query('SELECT * FROM banners ORDER BY created_at DESC');
    res.json({ success: true, data: banners || [] });
  } catch (error) {
    console.error(error);
    // As requested, return empty array on error instead of 500
    res.json({ success: false, data: [] });
  }
});

app.post('/api/admin/banners', async (req, res) => {
  const { image_url, link_url, title, subtitle, badge_text, is_active } = req.body;
  if (!image_url) {
    return res.status(400).json({ success: false, message: 'image_url is required' });
  }
  
  try {
    const [result] = await db.query(
      'INSERT INTO banners (image_url, link_url, title, subtitle, badge_text, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [image_url, link_url || null, title || null, subtitle || null, badge_text || null, is_active !== undefined ? is_active : true]
    );
    res.json({ success: true, message: 'Banner created', id: result.insertId });
  } catch (error) {
    console.error('Error creating banner:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

app.put('/api/admin/banners/:id', async (req, res) => {
  const id = req.params.id;
  const { image_url, link_url, title, subtitle, badge_text, is_active } = req.body;
  
  try {
    await db.query(
      'UPDATE banners SET image_url = COALESCE(?, image_url), link_url = ?, title = ?, subtitle = ?, badge_text = ?, is_active = COALESCE(?, is_active) WHERE id = ?',
      [image_url, link_url, title, subtitle, badge_text, is_active, id]
    );
    res.json({ success: true, message: 'Banner updated' });
  } catch (error) {
    console.error('Error updating banner:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

app.put('/api/admin/banners/:id/status', async (req, res) => {
  const { is_active } = req.body;
  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ success: false, message: 'is_active must be a boolean' });
  }
  try {
    const [result] = await db.query('UPDATE banners SET is_active = ? WHERE id = ?', [is_active, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Banner not found' });
    res.json({ success: true, message: 'Banner status updated' });
  } catch (error) {
    console.error('Error updating banner status:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

app.delete('/api/admin/banners/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await db.query('DELETE FROM banners WHERE id = ?', [id]);
    res.json({ success: true, message: 'Banner deleted' });
  } catch (error) {
    console.error('Error deleting banner:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// ==========================================
// RIDER APIS
// ==========================================

// 1. Rider Register
app.post('/api/rider/register', upload.fields([
    { name: 'id_card_image', maxCount: 1 },
    { name: 'license_image', maxCount: 1 },
    { name: 'vehicle_doc_image', maxCount: 1 }
  ]), async (req, res) => {
  const { email, password, phone, name, vehicle_type, vehicle_plate, real_name, license_number } = req.body;
  if (!email || !password || !phone || !name || !vehicle_plate || !real_name) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' });
  }

  const id_card_image = req.files && req.files['id_card_image'] ? '/uploads/' + req.files['id_card_image'][0].filename : '';
  const license_image = req.files && req.files['license_image'] ? '/uploads/' + req.files['license_image'][0].filename : '';
  const vehicle_doc_image = req.files && req.files['vehicle_doc_image'] ? '/uploads/' + req.files['vehicle_doc_image'][0].filename : '';

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check if email or phone exists
    const [existing] = await connection.query('SELECT * FROM users WHERE email = ? OR phone = ?', [email, phone]);
    if (existing.length > 0) {
      const user = existing[0];
      if (user.role === 'driver') {
        const [riderCheck] = await connection.query('SELECT * FROM riders WHERE user_id = ?', [user.user_id]);
        if (riderCheck.length > 0 && riderCheck[0].status === 'rejected') {
          // Allow resubmitting
          const salt = await bcrypt.genSalt(10);
          const password_hash = await bcrypt.hash(password, salt);
          await connection.query('UPDATE users SET password_hash = ?, phone = ?, full_name = ? WHERE user_id = ?', [password_hash, phone, name, user.user_id]);
          
          await connection.query(
            'UPDATE riders SET name=?, phone=?, real_name=?, vehicle_type=?, vehicle_plate=?, license_number=?, id_card_image=?, license_image=?, vehicle_doc_image=?, status="pending" WHERE user_id=?',
            [name, phone, real_name, vehicle_type, vehicle_plate, license_number, 
             id_card_image || riderCheck[0].id_card_image, 
             license_image || riderCheck[0].license_image, 
             vehicle_doc_image || riderCheck[0].vehicle_doc_image, 
             user.user_id]
          );
          
          await connection.commit();
          return res.json({ success: true, message: 'ส่งข้อมูลสมัครใหม่สำเร็จ รอการตรวจสอบ' });
        }
      }
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'อีเมลหรือเบอร์โทรศัพท์นี้ถูกใช้งานแล้ว' });
    }

    // Step 1: Hash password & Insert into users
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const [userResult] = await connection.query(
      'INSERT INTO users (email, phone, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, "driver", "active")',
      [email, phone, password_hash, name]
    );
    const userId = userResult.insertId;

    // Step 2: Insert into riders
    await connection.query(
      'INSERT INTO riders (user_id, name, phone, real_name, vehicle_type, vehicle_plate, license_number, id_card_image, license_image, vehicle_doc_image, status, rider_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending", "offline")',
      [userId, name, phone, real_name, vehicle_type, vehicle_plate, license_number, id_card_image, license_image, vehicle_doc_image]
    );

    await connection.commit();
    res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ รอการอนุมัติจากแอดมิน' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Rider register error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสมัคร' });
  } finally {
    if (connection) connection.release();
  }
});

// 2. Rider Login
app.post('/api/rider/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกอีเมลและรหัสผ่าน' });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash) || password === user.password_hash;
    
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    if (user.role !== 'driver' && user.role !== 'rider') {
      return res.status(403).json({ success: false, message: 'บัญชีนี้เป็นบัญชีลูกค้าปกติ ไม่สามารถใช้เข้าสู่ระบบแอปไรเดอร์ได้' });
    }

    const [riders] = await db.query('SELECT * FROM riders WHERE user_id = ?', [user.user_id]);
    
    if (riders.length === 0) {
      return res.status(401).json({ success: false, message: 'ไม่พบข้อมูลไรเดอร์' });
    }

    const rider = riders[0];
    if (rider.status === 'pending') {
      return res.status(401).json({ success: false, message: 'บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ' });
    }
    if (rider.status === 'rejected') {
      return res.status(403).json({ 
        success: false, 
        message: 'บัญชีของคุณถูกปฏิเสธ', 
        status: 'rejected', 
        reason: rider.reject_reason || 'ไม่ระบุเหตุผล',
        rider: rider,
        user: { email: user.email, phone: user.phone, full_name: user.full_name }
      });
    }

    // Mock generating a simple token
    const token = Buffer.from(`${user.user_id}-${Date.now()}`).toString('base64');
      const [ratingResult] = await db.query("SELECT COALESCE((SELECT AVG(rider_rating) FROM reviews WHERE rider_id = ? AND rider_rating > 0), rating, 0) as avg_rating FROM riders WHERE rider_id = ?", [rider.rider_id, rider.rider_id]);
      const avg_rating = ratingResult[0]?.avg_rating ? Number(ratingResult[0].avg_rating).toFixed(1) : 0;
      

    res.json({
      success: true,
      token,
      rider: {
        id: rider.rider_id,
        rider_id: rider.rider_id,
        user_id: user.user_id,
        name: rider.name || user.full_name,
        email: user.email,
        phone: user.phone,
        vehicle_plate: rider.vehicle_plate,
        status: rider.status,
        rider_status: rider.rider_status,
        rating: avg_rating,
      }
    });
  } catch (error) {
    console.error('Rider login error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดเซิร์ฟเวอร์' });
  }
});


// ==========================================
// DYNAMIC FARE & DISTANCE CALCULATION HELPER
// ==========================================
async function getDeliveryFareConfig() {
  try {
    const [settings] = await db.query('SELECT setting_key, setting_value FROM system_settings');
    const config = {};
    settings.forEach(s => {
      config[s.setting_key] = s.setting_value;
    });
    return {
      baseFee: parseFloat(config.base_delivery_fee) || 35,
      perKmFee: parseFloat(config.per_km_fee) || 8,
      riderSharePercent: parseFloat(config.rider_commission_percent) || 100,
      minOrder: parseFloat(config.minimum_order_value) || 50,
      gpPercent: parseFloat(config.platform_fee_percent) || 15
    };
  } catch (e) {
    return {
      baseFee: 35,
      perKmFee: 8,
      riderSharePercent: 100,
      minOrder: 50,
      gpPercent: 15
    };
  }
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 2.5;
  const p1 = parseFloat(lat1), p2 = parseFloat(lon1), p3 = parseFloat(lat2), p4 = parseFloat(lon2);
  if (isNaN(p1) || isNaN(p2) || isNaN(p3) || isNaN(p4) || (p1 === 0 && p2 === 0)) return 2.5;
  const R = 6371;
  const dLat = (p3 - p1) * (Math.PI / 180);
  const dLon = (p4 - p2) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1 * (Math.PI / 180)) * Math.cos(p3 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.max(0.5, Math.round(d * 10) / 10);
}

function computeFare(distanceKm, baseFee, perKmFee, riderSharePercent) {
  const km = parseFloat(distanceKm) || 2.5;
  const totalFare = baseFee + (km * perKmFee);
  const riderFee = totalFare * (riderSharePercent / 100);
  return {
    totalFare: Math.round(totalFare * 100) / 100,
    riderFee: Math.round(riderFee * 100) / 100
  };
}

// 3. Get Nearby Jobs (Dynamic Fare Calculation based on System Settings)
app.get('/api/rider/jobs', async (req, res) => {
  const { lat, lng } = req.query;
  try {
    const config = await getDeliveryFareConfig();

    // Auto-fix zero delivery fees on existing orders in DB
    try {
      await db.query(`
        UPDATE orders 
        SET delivery_fee = ? 
        WHERE (delivery_fee = 0 OR delivery_fee IS NULL) 
          AND (delivery_type = 'delivery' OR delivery_type IS NULL)
      `, [config.baseFee + (2.5 * config.perKmFee)]);
    } catch(e) {}

    const [orders] = await db.query(`
      SELECT o.order_id as order_id, o.total_amount, o.delivery_fee, o.order_status, o.created_at,
             o.latitude as customer_lat, o.longitude as customer_lng,
             s.shop_id as shop_id, s.name as shop_name, s.latitude as shop_lat, s.longitude as shop_lng, s.address as shop_address,
             u.full_name as customer_name, u.phone as customer_phone, o.shipping_address as customer_address
      FROM orders o
      JOIN shops s ON o.shop_id = s.shop_id
      JOIN users u ON o.user_id = u.user_id
      LEFT JOIN deliveries del ON o.order_id = del.order_id
      WHERE o.order_status IN ('preparing', 'ready') AND o.delivery_type != 'pickup' AND (del.id IS NULL OR del.status = 'cancelled')
      ORDER BY o.created_at ASC
    `);

    // Fetch all distinct pickup shops and items for each order
    const orderIds = orders.map(o => o.order_id);
    let shopsByOrderId = {};
    let itemsByOrderId = {};
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      try {
        const [orderShops] = await db.query(`
          SELECT DISTINCT oi.order_id, s.shop_id, s.name as shop_name, s.address as shop_address, s.latitude as shop_lat, s.longitude as shop_lng, owner.phone as shop_phone
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.product_id
          LEFT JOIN shops s ON (oi.shop_id = s.shop_id OR p.shop_id = s.shop_id)
          LEFT JOIN users owner ON s.owner_id = owner.user_id
          WHERE oi.order_id IN (${placeholders}) AND s.shop_id IS NOT NULL
        `, orderIds);

        orderShops.forEach(s => {
          if (!shopsByOrderId[s.order_id]) shopsByOrderId[s.order_id] = [];
          if (!shopsByOrderId[s.order_id].some(existing => existing.shop_id === s.shop_id)) {
            shopsByOrderId[s.order_id].push({
              ...s,
              shop_phone: s.shop_phone || '021234567',
              items: []
            });
          }
        });
      } catch (shopErr) {
        console.error('Error fetching order shops for rider:', shopErr.message);
      }

      try {
        const [orderItems] = await db.query(`
          SELECT oi.*, p.name as db_product_name, COALESCE(s.name, '') as shop_name, COALESCE(s.shop_id, oi.shop_id) as item_shop_id
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.product_id
          LEFT JOIN shops s ON (oi.shop_id = s.shop_id OR p.shop_id = s.shop_id)
          WHERE oi.order_id IN (${placeholders})
        `, orderIds);

        orderItems.forEach(item => {
          const formattedItem = {
            ...item,
            name: item.product_name || item.db_product_name || 'สินค้า',
            product_name: item.product_name || item.db_product_name || 'สินค้า',
            quantity: item.quantity || 1,
            price: item.price || 0
          };
          if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
          itemsByOrderId[item.order_id].push(formattedItem);

          if (shopsByOrderId[item.order_id]) {
            const matchedShop = shopsByOrderId[item.order_id].find(s => s.shop_id == item.item_shop_id);
            if (matchedShop) {
              if (!matchedShop.items) matchedShop.items = [];
              matchedShop.items.push(formattedItem);
            }
          }
        });
      } catch (itemErr) {
        console.error('Error fetching order items for rider jobs:', itemErr.message);
      }
    }

    const formattedOrders = orders.map(o => {
      let pickupShops = shopsByOrderId[o.order_id] && shopsByOrderId[o.order_id].length > 0
        ? shopsByOrderId[o.order_id]
        : [{ shop_id: o.shop_id, shop_name: o.shop_name, shop_address: o.shop_address, shop_lat: o.shop_lat, shop_lng: o.shop_lng, items: [] }];

      const orderItems = itemsByOrderId[o.order_id] || [];
      if (pickupShops.length === 1 && (!pickupShops[0].items || pickupShops[0].items.length === 0)) {
        pickupShops[0].items = orderItems;
      }

      const shopNames = pickupShops.map(s => s.shop_name).join(' + ');
      const isMultiShop = pickupShops.length > 1;

      const distKm = calculateDistanceKm(o.shop_lat, o.shop_lng, o.customer_lat, o.customer_lng);
      const fareInfo = computeFare(distKm, config.baseFee, config.perKmFee, config.riderSharePercent);
      
      let finalFee = parseFloat(o.delivery_fee) || 0;
      if (finalFee <= 0) {
        finalFee = fareInfo.riderFee;
      } else {
        finalFee = Math.round((finalFee * (config.riderSharePercent / 100)) * 100) / 100;
      }

      return {
        ...o,
        shop_name: isMultiShop ? `${pickupShops[0].shop_name} + อีก ${pickupShops.length - 1} ร้าน (${pickupShops.length} จุดรับ)` : o.shop_name,
        shops: pickupShops,
        pickup_shops: pickupShops,
        pickup_count: pickupShops.length,
        is_multi_shop: isMultiShop,
        all_shop_names: shopNames,
        items: orderItems,
        distance: `${distKm} กม.`,
        delivery_fee: finalFee
      };
    });

    res.json({ success: true, data: formattedOrders, jobs: formattedOrders });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดเซิร์ฟเวอร์' });
  }
});

// 4. Update Delivery Status (Accept Job, Picking up, Delivering)
app.put('/api/rider/deliveries/:order_id/status', async (req, res) => {
  const orderId = req.params.order_id;
  const { rider_id, status } = req.body;
  const deliveryStatuses = ['accepted', 'arriving_shop', 'picked_up', 'delivering'];
  if (!rider_id || !deliveryStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'ข้อมูลสถานะหรือไรเดอร์ไม่ถูกต้อง' });
  }
  
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    // If accepting the job, we create a record in deliveries table
    if (status === 'accepted') {
      const [orders] = await connection.query('SELECT order_id, order_status, delivery_type FROM orders WHERE order_id = ? FOR UPDATE', [orderId]);
      if (orders.length === 0 || orders[0].delivery_type !== 'delivery' || !['preparing', 'ready'].includes(orders[0].order_status)) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'ออเดอร์นี้ไม่พร้อมให้รับงาน' });
      }
      const [riders] = await connection.query('SELECT rider_id FROM riders WHERE rider_id = ? AND status = "approved" FOR UPDATE', [rider_id]);
      if (riders.length === 0) {
        await connection.rollback();
        return res.status(403).json({ success: false, message: 'ไรเดอร์ไม่ได้รับอนุมัติ' });
      }
      const [existingDeliveries] = await connection.query('SELECT id FROM deliveries WHERE order_id = ? FOR UPDATE', [orderId]);
      if (existingDeliveries.length > 0) {
         await connection.rollback();
         return res.status(400).json({ success: false, message: 'ออเดอร์นี้ถูกรับไปแล้ว' });
      }

      await connection.query(
        'INSERT INTO deliveries (order_id, rider_id, status, assigned_at) VALUES (?, ?, ?, NOW())',
        [orderId, rider_id, 'accepted']
      );
      await connection.query('UPDATE orders SET rider_id = ? WHERE order_id = ?', [rider_id, orderId]);

      // Notify Buyer & Shop
      try {
        const [oRows] = await connection.query('SELECT user_id, shop_id FROM orders WHERE order_id = ?', [orderId]);
        if (oRows.length > 0) {
          const buyerId = oRows[0].user_id;
          const sId = oRows[0].shop_id;
          if (buyerId) {
            await connection.query(
              'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
              [buyerId, `🛵 ไรเดอร์รับงานแล้ว (#${orderId})`, 'ไรเดอร์กำลังเดินทางไปรับสินค้าที่ร้านค้า', String(orderId)]
            );
          }
          if (sId) {
            const [sRows] = await connection.query('SELECT owner_id FROM shops WHERE shop_id = ?', [sId]);
            if (sRows.length > 0 && sRows[0].owner_id) {
              await connection.query(
                'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
                [sRows[0].owner_id, `🛵 ไรเดอร์กำลังมารับสินค้า (#${orderId})`, `มีไรเดอร์รับงานคำสั่งซื้อ #${orderId} แล้ว กำลังเดินทางมาที่ร้าน`, String(orderId)]
              );
            }
          }
        }
      } catch(ne) {}

      await connection.commit();
      return res.json({ success: true, message: 'รับงานสำเร็จ' });
    }

    const [result] = await connection.query('UPDATE deliveries SET status = ? WHERE order_id = ? AND rider_id = ? AND status <> "delivered"', [status, orderId, rider_id]);
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'ไม่พบงานที่ไรเดอร์รับไว้' });
    }
    
    // Sync with order_status
    if (status === 'picked_up' || status === 'delivering') {
      await connection.query('UPDATE orders SET order_status = "delivering" WHERE order_id = ?', [orderId]);
    } else if (status === 'delivered') {
      await connection.query('UPDATE orders SET order_status = "delivered" WHERE order_id = ?', [orderId]);
    }
    
    await connection.commit();
    res.json({ success: true, message: 'อัปเดตสถานะสำเร็จ' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Update delivery status error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดเซิร์ฟเวอร์' });
  } finally {
    if (connection) connection.release();
  }
});


// 4.1 Proof of Pickup (Rider receives food from Shop with photo verification per shop)
app.post('/api/rider/deliveries/:order_id/pickup', upload.single('pickup_image'), async (req, res) => {
  const orderId = req.params.order_id;
  const { rider_id, shop_id, pickup_proof_image, is_all_picked_up } = req.body;
  const uploadedImage = req.file ? `/uploads/${req.file.filename}` : (pickup_proof_image || '');

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [orderRows] = await connection.query('SELECT order_status, shop_id FROM orders WHERE order_id = ? FOR UPDATE', [orderId]);
    if (orderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลคำสั่งซื้อ' });
    }

    // Get current deliveries record
    const [delRows] = await connection.query('SELECT id, pickup_proofs, pickup_proof_image FROM deliveries WHERE order_id = ? AND rider_id = ? FOR UPDATE', [orderId, rider_id]);
    
    let proofsMap = {};
    if (delRows.length > 0 && delRows[0].pickup_proofs) {
      try {
        proofsMap = typeof delRows[0].pickup_proofs === 'string' ? JSON.parse(delRows[0].pickup_proofs) : delRows[0].pickup_proofs;
      } catch (e) {
        proofsMap = {};
      }
    }

    const targetShopId = String(shop_id || orderRows[0].shop_id || '1');
    proofsMap[targetShopId] = {
      shop_id: targetShopId,
      proof_image: uploadedImage,
      picked_up_at: new Date().toISOString()
    };

    // Find all distinct pickup shops for this order
    const [orderShops] = await connection.query(`
      SELECT DISTINCT s.shop_id, s.name as shop_name, s.owner_id
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.product_id
      LEFT JOIN shops s ON (oi.shop_id = s.shop_id OR p.shop_id = s.shop_id)
      WHERE oi.order_id = ? AND s.shop_id IS NOT NULL
    `, [orderId]);

    const allShopIds = orderShops.length > 0 ? orderShops.map(s => String(s.shop_id)) : [String(orderRows[0].shop_id || '1')];
    const pickedUpCount = allShopIds.filter(id => proofsMap[id] && proofsMap[id].proof_image).length;
    const reallyAllPickedUp = is_all_picked_up === true || is_all_picked_up === 'true' || pickedUpCount >= allShopIds.length;

    const newDeliveryStatus = reallyAllPickedUp ? 'delivering' : 'accepted';
    const newOrderStatus = reallyAllPickedUp ? 'delivering' : orderRows[0].order_status;

    await connection.query(
      'UPDATE deliveries SET status = ?, pickup_proofs = ?, pickup_proof_image = ?, pickup_at = NOW() WHERE order_id = ? AND rider_id = ?',
      [newDeliveryStatus, JSON.stringify(proofsMap), uploadedImage, orderId, rider_id]
    );

    if (reallyAllPickedUp) {
      await connection.query(
        'UPDATE orders SET order_status = "delivering" WHERE order_id = ?',
        [orderId]
      );
    }

    // 1. Notify ONLY the specific Shop Owner that was just picked up
    try {
      const [shopOwner] = await connection.query('SELECT owner_id, name FROM shops WHERE shop_id = ?', [targetShopId]);
      if (shopOwner.length > 0 && shopOwner[0].owner_id) {
        await connection.query(
          'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
          [shopOwner[0].owner_id, `🛵 ไรเดอร์รับสินค้าจากร้าน ${shopOwner[0].name} แล้ว (#${orderId})`, 'ไรเดอร์ได้ถ่ายรูปยืนยันรับสินค้าจากร้านของคุณเรียบร้อยแล้ว', String(orderId)]
        );
      }
    } catch(ne) {}

    // 2. Auto post pickup proof message & photo ONLY to this Shop Seller Chat Channel
    try {
      const [sInfo] = await connection.query('SELECT name FROM shops WHERE shop_id = ?', [targetShopId]);
      const sName = sInfo.length > 0 ? sInfo[0].name : 'ร้านค้า';
      await connection.query(
        'INSERT INTO order_messages (order_id, shop_id, sender_id, sender_type, receiver_type, message, image_url) VALUES (?, ?, ?, "rider", "seller", ?, ?)',
        [orderId, targetShopId, rider_id, `🛵 [ยืนยันรับสินค้าแล้ว] ไรเดอร์ได้รับสินค้าจาก "${sName}" เรียบร้อยแล้วครับ`, uploadedImage || null]
      );
    } catch(e) {
      console.error('Error auto-posting pickup proof to shop chat:', e);
    }

    // 3. If ALL shops are picked up, notify Buyer & post to Buyer Chat Channel
    if (reallyAllPickedUp) {
      try {
        const [oRows] = await connection.query('SELECT user_id FROM orders WHERE order_id = ?', [orderId]);
        if (oRows.length > 0 && oRows[0].user_id) {
          await connection.query(
            'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
            [oRows[0].user_id, `🛵 ไรเดอร์รับสินค้าครบทุกร้านแล้ว (#${orderId})`, 'ไรเดอร์ได้รับสินค้าครบทุกร้านแล้ว และกำลังเดินทางนำส่งให้คุณ', String(orderId)]
          );
        }
      } catch(ne) {}

      try {
        await connection.query(
          'INSERT INTO order_messages (order_id, sender_id, sender_type, receiver_type, message, image_url) VALUES (?, NULL, ?, "rider", "buyer", ?, ?)',
          [orderId, rider_id, '🛵 [รับสินค้าครบแล้ว] ไรเดอร์ได้รับสินค้าครบทุกร้านค้าเรียบร้อยแล้ว กำลังเดินทางไปส่งให้คุณลูกค้าครับ', uploadedImage || null]
        );
      } catch(e) {}
    }

    await connection.commit();
    res.json({
      success: true,
      message: reallyAllPickedUp ? 'รับสินค้าครบทุกร้านแล้ว กำลังไปส่งลูกค้า' : 'ยืนยันการรับสินค้าร้านนี้เรียบร้อย',
      is_all_picked_up: reallyAllPickedUp,
      picked_up_count: pickedUpCount,
      total_shops: allShopIds.length,
      proofs: proofsMap
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Pickup error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดเซิร์ฟเวอร์' });
  } finally {
    if (connection) connection.release();
  }
});

// 6. Rider Complete & Confirm (Complete Delivery)
app.post('/api/rider/deliveries/:order_id/complete', upload.single('proof_image'), async (req, res) => {
  const orderId = req.params.order_id;
  const { rider_id, proof_image_base64 } = req.body;
  const proof_image = req.file ? `/uploads/${req.file.filename}` : (proof_image_base64 || req.body.proof_image || '');

  try {
    await db.query(
      'UPDATE deliveries SET status = "delivered", proof_image = ?, completed_at = NOW() WHERE order_id = ? AND rider_id = ?',
      [proof_image, orderId, rider_id]
    );

    await db.query('UPDATE orders SET order_status = "delivered", delivered_at = CURRENT_TIMESTAMP WHERE order_id = ?', [orderId]);

    // Notify Buyer & Shop
    try {
      const [oRows] = await db.query('SELECT user_id, shop_id FROM orders WHERE order_id = ?', [orderId]);
      if (oRows.length > 0) {
        const buyerId = oRows[0].user_id;
        const sId = oRows[0].shop_id;
        if (buyerId) {
          await db.query(
            'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
            [buyerId, `🎉 ไรเดอร์จัดส่งสินค้าถึงที่หมายแล้ว (#${orderId})`, 'สินค้าส่งถึงที่หมายแล้ว กรุณาตรวจสอบและกดยืนยันการรับสินค้า', String(orderId)]
          );
        }
        if (sId) {
          const [sRows] = await db.query('SELECT owner_id FROM shops WHERE shop_id = ?', [sId]);
          if (sRows.length > 0 && sRows[0].owner_id) {
            await db.query(
              'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
              [sRows[0].owner_id, `🎉 ไรเดอร์ส่งสินค้าเรียบร้อย (#${orderId})`, `คำสั่งซื้อ #${orderId} ถูกจัดส่งถึงลูกค้าเรียบร้อยแล้ว`, String(orderId)]
            );
          }
        }
      }
    } catch(ne) {}

    // Auto post delivery proof message & photo to Customer (Buyer <-> Rider channel)
    try {
      await db.query(
        'INSERT INTO order_messages (order_id, sender_id, sender_type, receiver_type, message, image_url) VALUES (?, ?, "rider", "buyer", ?, ?)',
        [orderId, rider_id, '📸 [ส่งมอบสำเร็จ] ไรเดอร์ได้นำส่งสินค้าให้คุณลูกค้าเรียบร้อยแล้วครับ ขอบคุณที่ใช้บริการ SmartDeal ครับ', proof_image || null]
      );
    } catch(e) {
      console.error('Error auto-posting dropoff proof to chat:', e);
    }

    res.json({ success: true, message: 'ยืนยันการจัดส่งสำเร็จ' });
  } catch (error) {
    console.error('Complete delivery error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดเซิร์ฟเวอร์' });
  }
});

// 7. Rider Wallet API
app.get('/api/rider/wallet', async (req, res) => {
  const riderId = req.query.rider_id;
  if (!riderId) return res.status(400).json({ success: false, message: 'Missing rider_id' });

  try {
    const [wallets] = await db.query('SELECT balance FROM rider_wallets WHERE rider_id = ?', [riderId]);
    let balance = 0;
    if (wallets.length > 0) {
      balance = wallets[0].balance;
    } else {
      // รายได้ที่เงินเข้ากระเป๋าใช้ได้จริง: นับเฉพาะออเดอร์ที่ลูกค้ายืนยันรับของแล้วเท่านั้น (completed)
      const [delivs] = await db.query("SELECT SUM(o.delivery_fee) as earned FROM deliveries d JOIN orders o ON d.order_id = o.order_id WHERE d.rider_id = ? AND (d.status = 'completed' OR o.order_status = 'completed')", [riderId]);
      const [withdraws] = await db.query("SELECT SUM(amount) as withdrawn FROM wallet_transactions WHERE user_type = 'rider' AND target_id = ? AND type = 'debit'", [riderId]);
      const [pendingW] = await db.query("SELECT SUM(amount) as p_amount FROM withdrawals WHERE user_type = 'rider' AND rider_id = ? AND status = 'pending'", [riderId]);
      const pendingWithdrawn = pendingW[0]?.p_amount || 0;
      
      const earned = delivs[0].earned || 0;
      const withdrawn = withdraws[0].withdrawn || 0;
      balance = Number(earned) - Number(withdrawn);
    }

    // ยอดเงินที่ส่งมอบแล้วแต่รอลูกค้ายืนยัน (Pending Customer Confirmation)
    const [pendingDelivs] = await db.query("SELECT SUM(o.delivery_fee) as pending_income, COUNT(d.id) as pending_jobs FROM deliveries d JOIN orders o ON d.order_id = o.order_id WHERE d.rider_id = ? AND d.status = 'delivered' AND o.order_status = 'delivered'", [riderId]);
    const pendingIncome = pendingDelivs[0]?.pending_income || 0;

    const [todayStats] = await db.query("SELECT COUNT(d.id) as jobs, SUM(o.delivery_fee) as income FROM deliveries d JOIN orders o ON d.order_id = o.order_id WHERE d.rider_id = ? AND (d.status = 'completed' OR o.order_status = 'completed') AND DATE(d.completed_at) = CURRENT_DATE()", [riderId]);
    const todayJobs = todayStats[0].jobs || 0;
    const todayIncome = todayStats[0].income || 0;

    const [deliveries] = await db.query("SELECT d.id, d.completed_at as created_at, o.delivery_fee as amount, 'credit' as type, s.name as description, d.status as delivery_status, o.order_status FROM deliveries d JOIN orders o ON d.order_id = o.order_id JOIN shops s ON o.shop_id = s.shop_id WHERE d.rider_id = ? AND (d.status = 'delivered' OR d.status = 'completed') ORDER BY d.completed_at DESC LIMIT 15", [riderId]);
    
    const [walletTx] = await db.query("SELECT id, created_at, amount, type, description FROM wallet_transactions WHERE user_type = 'rider' AND target_id = ? ORDER BY created_at DESC LIMIT 15", [riderId]);

    let history = [...deliveries, ...walletTx];
    history.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).reverse();
    history = history.slice(0, 20);

    
    const [ratingResult] = await db.query("SELECT COALESCE((SELECT AVG(rider_rating) FROM reviews WHERE rider_id = ? AND rider_rating > 0), rating, 0) as avg_rating FROM riders WHERE rider_id = ?", [riderId, riderId]);
    const rating = ratingResult[0]?.avg_rating ? Number(ratingResult[0].avg_rating).toFixed(1) : 0;

    res.json({ success: true, balance, todayIncome, todayJobs, pendingIncome, history, rating });
  } catch (error) {
    console.error('Wallet API error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 8. Rider Job Details
app.get('/api/rider/jobs/:order_id', async (req, res) => {
  try {
    const orderId = req.params.order_id;
    const [jobs] = await db.query(`
      SELECT o.order_id as order_id, o.total_amount, o.delivery_fee, o.order_status, o.created_at,
             s.shop_id, s.name as shop_name, s.address as shop_address, s.latitude as shop_lat, s.longitude as shop_lng,
             owner.phone as shop_phone,
             o.shipping_address as customer_address, o.latitude as customer_lat, o.longitude as customer_lng,
             u.full_name as customer_name, u.phone as customer_phone, d.status as delivery_status,
             d.pickup_proofs, d.pickup_proof_image, d.proof_image,
             o.note_for_rider
      FROM orders o
      JOIN shops s ON o.shop_id = s.shop_id
      LEFT JOIN users owner ON s.owner_id = owner.user_id
      LEFT JOIN users u ON o.user_id = u.user_id
      LEFT JOIN deliveries d ON d.order_id = o.order_id
      WHERE o.order_id = ?
    `, [orderId]);
    
    if (jobs.length > 0) {
      const job = jobs[0];

      let proofsMap = {};
      if (job.pickup_proofs) {
        try {
          proofsMap = typeof job.pickup_proofs === 'string' ? JSON.parse(job.pickup_proofs) : job.pickup_proofs;
        } catch(e) {}
      }

      let pickupShops = [{
        shop_id: job.shop_id,
        shop_name: job.shop_name,
        shop_address: job.shop_address,
        shop_lat: job.shop_lat,
        shop_lng: job.shop_lng,
        shop_phone: job.shop_phone || '021234567',
        is_picked_up: !!(proofsMap[String(job.shop_id)]?.proof_image),
        proof_image: proofsMap[String(job.shop_id)]?.proof_image || null
      }];

      try {
        const [orderShops] = await db.query(`
          SELECT DISTINCT s.shop_id, s.name as shop_name, s.address as shop_address, s.latitude as shop_lat, s.longitude as shop_lng, owner.phone as shop_phone
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.product_id
          LEFT JOIN shops s ON (oi.shop_id = s.shop_id OR p.shop_id = s.shop_id)
          LEFT JOIN users owner ON s.owner_id = owner.user_id
          WHERE oi.order_id = ? AND s.shop_id IS NOT NULL
        `, [orderId]);

        if (orderShops.length > 0) {
          pickupShops = orderShops.map(s => {
            const sKey = String(s.shop_id);
            const proof = proofsMap[sKey]?.proof_image || null;
            return {
              ...s,
              shop_phone: s.shop_phone || '021234567',
              is_picked_up: !!proof,
              proof_image: proof
            };
          });
        }
      } catch (shopErr) {
        console.error('Error fetching pickup shops for job detail:', shopErr.message);
      }

      let items = [];
      try {
        const [itemRows] = await db.query(`
          SELECT oi.*, p.name as db_product_name, COALESCE(s.name, '') as shop_name,
                 COALESCE(oi.shop_id, p.shop_id) as item_shop_id
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.product_id
          LEFT JOIN shops s ON (oi.shop_id = s.shop_id OR p.shop_id = s.shop_id)
          WHERE oi.order_id = ?
        `, [orderId]);

        items = itemRows.map(item => ({
          ...item,
          product_name: item.product_name || item.db_product_name || 'สินค้า',
          shop_id: item.item_shop_id || job.shop_id
        }));
      } catch (itemErr) {
        console.error('Error fetching order items for job detail:', itemErr.message);
      }

      pickupShops = pickupShops.map(shop => {
        const shopItems = items.filter(it => Number(it.shop_id) === Number(shop.shop_id));
        return {
          ...shop,
          items: shopItems.map(it => ({
            name: it.product_name,
            quantity: it.quantity || 1,
            price: it.price
          }))
        };
      });

      const isMulti = pickupShops.length > 1;
      const allDone = isMulti ? pickupShops.every(s => s.is_picked_up) : !!pickupShops[0]?.is_picked_up;

      res.json({
        success: true,
        data: {
          ...job,
          pickup_proofs: proofsMap,
          shop_phone: job.shop_phone || '021234567',
          shops: pickupShops,
          pickup_shops: pickupShops,
          is_multi_shop: isMulti,
          delivery_status: allDone ? (job.delivery_status || 'delivering') : 'accepted',
          items: items
        }
      });
    } else {
      res.status(404).json({ success: false, message: 'Job not found' });
    }
  } catch (error) {
    console.error('Error fetching job details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 6. Rider Deliveries & Earnings History (Active + Completed)
app.get('/api/rider/:id/history', async (req, res) => {
  const riderId = req.params.id;
  try {
    const [deliveries] = await db.query(`
      SELECT d.id as delivery_id, d.status, d.assigned_at, d.completed_at, d.proof_image,
             o.order_id, o.order_status, o.delivery_fee, o.total_amount,
             o.shipping_address as customer_address, o.shipping_address as delivery_address,
             u.full_name as customer_name, u.phone as customer_phone,
             s.shop_id, s.name as shop_name, s.name as restaurant_name, s.address as shop_address,
             s.latitude as shop_lat, s.longitude as shop_lng,
             o.latitude as customer_lat, o.longitude as customer_lng, o.note_for_rider
      FROM deliveries d
      JOIN orders o ON d.order_id = o.order_id
      JOIN shops s ON o.shop_id = s.shop_id
      JOIN users u ON o.user_id = u.user_id
      WHERE d.rider_id = ?
      ORDER BY d.id DESC
    `, [riderId]);

    const total_earnings = deliveries
      .filter(item => item.status === 'delivered' || item.status === 'completed')
      .reduce((sum, item) => sum + Number(item.delivery_fee || 0), 0);

    res.json({ 
      success: true, 
      data: {
        total_earnings,
        deliveries
      }
    });
  } catch (error) {
    console.error('Get rider history error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดเซิร์ฟเวอร์' });
  }
});

// ==========================================
// END RIDER APIS
// ==========================================



// ====== ADMIN KYC ROUTES ======
// Get all approved riders
app.get('/api/admin/riders', async (req, res) => {
  try {
    const [riders] = await db.query(`
      SELECT 
        r.rider_id,
        r.user_id,
        r.real_name, 
        r.name,
        r.phone, 
        r.vehicle_plate as license_plate, 
        r.rider_status,
        r.status,
        COALESCE((SELECT ROUND(AVG(rev.rider_rating), 1) FROM reviews rev WHERE rev.rider_id = r.rider_id AND rev.rider_rating IS NOT NULL), r.rating, 5.0) AS average_rating,
        u.email,
        (SELECT COUNT(*) FROM deliveries d WHERE d.rider_id = r.rider_id AND d.status = 'delivered') AS total_jobs
      FROM riders r 
      LEFT JOIN users u ON r.user_id = u.user_id 
      WHERE r.status = 'approved' OR r.status = 'ACTIVE'
      ORDER BY r.created_at DESC
    `);
    res.json({ success: true, riders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get rider deep details
app.get('/api/admin/riders/:id/details', async (req, res) => {
  try {
    const riderId = req.params.id;
    // 1. Profile
    const [profileData] = await db.query(`
      SELECT r.*, u.email, u.full_name as user_full_name
      FROM riders r
      LEFT JOIN users u ON r.user_id = u.user_id
      WHERE r.rider_id = ?
    `, [riderId, riderId]);

    if (profileData.length === 0) {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }
    const profile = profileData[0];

    // 2. Stats
    let stats = { total_jobs: 0, total_earnings: 0 };
    try {
      const [statsData] = await db.query(`
        SELECT 
          COUNT(*) as total_jobs,
          SUM(o.delivery_fee) as total_earnings
        FROM deliveries d
        JOIN orders o ON d.order_id = o.order_id
        WHERE d.rider_id = ? AND d.status = 'delivered'
      `, [profile.rider_id]);
      if (statsData.length > 0) {
        stats = statsData[0];
      }
    } catch (e) {
      console.log('Stats error:', e.message);
    }
    
    // 3. History
    let history = [];
    try {
      const [historyData] = await db.query(`
        SELECT d.*, o.shop_id, s.name as shop_name
        FROM deliveries d
        JOIN orders o ON d.order_id = o.order_id
        LEFT JOIN shops s ON o.shop_id = s.shop_id
        WHERE d.rider_id = ?
        ORDER BY d.assigned_at DESC
        LIMIT 10
      `, [profile.rider_id]);
      history = historyData;
    } catch (e) {
      console.log('History error:', e.message);
    }

    // 4. Reviews
    let reviews = [];
    try {
      const [reviewData] = await db.query(`
        SELECT 
          COALESCE(r.rider_rating, r.rating) AS rating, 
          COALESCE(r.rider_comment, r.comment) AS comment, 
          r.created_at,
          u.full_name AS customer_name
        FROM reviews r
        LEFT JOIN users u ON r.user_id = u.user_id
        LEFT JOIN orders o ON r.order_id = o.order_id
        WHERE (r.rider_id = ? OR o.rider_id = ?) AND (r.rider_rating IS NOT NULL OR r.rider_comment IS NOT NULL)
        ORDER BY r.created_at DESC
        LIMIT 20
      `, [profile.rider_id, profile.rider_id]);
      reviews = reviewData;
    } catch (e) {
      console.log('Reviews error:', e.message);
    }

    res.json({
      success: true,
      data: {
        profile,
        stats,
        history,
        reviews
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all pending riders
app.get('/api/admin/riders/pending', async (req, res) => {
  try {
    const [riders] = await db.query(`
      SELECT r.*, u.full_name, u.phone 
      FROM riders r 
      JOIN users u ON r.user_id = u.user_id 
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC
    `);
    res.json({ success: true, riders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get rider details
app.get('/api/admin/riders/:id', async (req, res) => {
  try {
    const [riders] = await db.query(`
      SELECT r.*, u.full_name, u.phone 
      FROM riders r 
      JOIN users u ON r.user_id = u.user_id 
      WHERE r.rider_id = ?
    `, [req.params.id]);
    if (riders.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, rider: riders[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Approve rider
app.put('/api/admin/riders/:id/approve', async (req, res) => {
  try {
    const [result] = await db.query('UPDATE riders SET status = "approved", reject_reason = NULL WHERE rider_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Rider not found' });
    res.json({ success: true, message: 'Rider approved successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Reject rider
app.put('/api/admin/riders/:id/reject', async (req, res) => {
  const { reason } = req.body;
  try {
    const [result] = await db.query('UPDATE riders SET status = "rejected", reject_reason = ? WHERE rider_id = ?', [reason || 'ไม่ระบุเหตุผล', req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Rider not found' });

    // ส่งแจ้งเตือนผ่าน In-App Notification (วิธีที่ 2)
    const [riderData] = await db.query('SELECT user_id FROM riders WHERE rider_id = ?', [req.params.id]);
    if (riderData.length > 0) {
      await db.execute(`INSERT INTO notifications (user_id, title, message, type, reference_id) VALUES (?, ?, ?, ?, ?)`, 
        [riderData[0].user_id, 'คำขอสมัครไรเดอร์ถูกปฏิเสธ', `คำขอของคุณถูกปฏิเสธเนื่องจาก: ${reason || 'ไม่ระบุเหตุผล'}`, 'rider_rejected', req.params.id]);
    }

    res.json({ success: true, message: 'Rider rejected successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Admin Ticket Management
app.get('/api/admin/tickets', async (req, res) => {
  try {
    const [results] = await db.execute(`
      SELECT oi.issue_id, oi.order_id, oi.user_id, oi.issue_topic, oi.issue_detail, oi.status, oi.created_at, u.full_name AS reporter_name, u.role AS reporter_role
      FROM order_issues oi
      JOIN users u ON oi.user_id = u.user_id
      ORDER BY oi.created_at DESC
    `);
    res.json(results);
  } catch (error) {
    console.error('API /api/admin/tickets Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/admin/tickets/:id', async (req, res) => {
  const issueId = req.params.id;
  try {
    const [issue] = await db.execute(`
      SELECT oi.*, u.full_name AS reporter_name, u.email AS reporter_email, u.phone AS reporter_phone, u.role AS reporter_role, u.avatar_url AS reporter_avatar
      FROM order_issues oi
      JOIN users u ON oi.user_id = u.user_id
      WHERE oi.issue_id = ?
    `, [issueId]);

    if (issue.length === 0) return res.status(404).json({ error: 'Ticket not found' });

    const orderId = issue[0].order_id;
    const [orderInfo] = await db.execute(`
      SELECT o.order_id, o.total_amount, o.order_status, o.created_at, s.name AS shop_name, s.shop_id
      FROM orders o
      LEFT JOIN shops s ON o.shop_id = s.shop_id
      WHERE o.order_id = ?
    `, [orderId]);

    res.json({
      ticket: issue[0],
      order: orderInfo.length > 0 ? orderInfo[0] : null
    });
  } catch (error) {
    console.error('API /api/admin/tickets/:id Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/admin/tickets/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'investigating', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const [result] = await db.execute('UPDATE order_issues SET status = ? WHERE issue_id = ?', [status, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ success: true, message: 'Ticket status updated' });
  } catch (error) {
    console.error('API /api/admin/tickets/:id/status Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});


// ==========================================
// System Settings (God Mode)
// ==========================================
// Public System Settings API for Mobile Apps
app.get('/api/settings', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT setting_key, setting_value FROM system_settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });
    res.json({
      success: true,
      settings,
      base_delivery_fee: parseFloat(settings.base_delivery_fee) || 25,
      per_km_fee: parseFloat(settings.per_km_fee) || 8,
      minimum_order_value: parseFloat(settings.minimum_order_value) || 50,
      platform_fee_percent: parseFloat(settings.platform_fee_percent) || 15,
      rider_commission_percent: parseFloat(settings.rider_commission_percent) || 90
    });
  } catch (error) {
    console.error('API /api/settings Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/system-settings', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT setting_key, setting_value FROM system_settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });
    res.json({
      success: true,
      settings,
      base_delivery_fee: parseFloat(settings.base_delivery_fee) || 25,
      per_km_fee: parseFloat(settings.per_km_fee) || 8,
      minimum_order_value: parseFloat(settings.minimum_order_value) || 50,
      platform_fee_percent: parseFloat(settings.platform_fee_percent) || 15,
      rider_commission_percent: parseFloat(settings.rider_commission_percent) || 90
    });
  } catch (error) {
    console.error('API /api/system-settings Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/settings', async (req, res) => {
  try {
    const [settings] = await db.execute('SELECT * FROM system_settings');
    res.json({ success: true, settings });
  } catch (error) {
    console.error('API /api/admin/settings Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/admin/settings', async (req, res) => {
  const { settings } = req.body; // Expect array of { setting_key, setting_value }
  
  if (!Array.isArray(settings)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const setting of settings) {
      await connection.execute(
        'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
        [setting.setting_value, setting.setting_key]
      );
    }
    await connection.commit();
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('API PUT /api/admin/settings Error:', error);
    res.status(500).json({ error: 'Database error' });
  } finally {
    connection.release();
  }
});

// ==========================================
// DYNAMIC QR PAYMENT ENDPOINTS
// ==========================================

app.post('/api/payment/generate-qr', async (req, res) => {
  try {
    const { order_id, total_amount } = req.body;
    if (!order_id || !total_amount) {
      return res.status(400).json({ error: 'order_id and total_amount are required' });
    }

    // 1. Generate Mock Charge ID
    const charge_id = 'chrg_mock_' + Date.now();

    // 2. Generate PromptPay QR Payload (Use SYSTEM_PROMPTPAY_ID, e.g. 0817466755)
    const SYSTEM_PROMPTPAY_ID = '0817466755';
    const payload = generatePayload(SYSTEM_PROMPTPAY_ID, { amount: parseFloat(total_amount) });

    // 3. Convert payload to QR image (Data URL)
    const qrImage = await QRCode.toDataURL(payload);

    // 4. Update order with charge_id and pending status
    await db.query(
      "UPDATE orders SET charge_id = ?, payment_status = 'pending' WHERE order_id = ?",
      [charge_id, order_id]
    );

    res.json({ success: true, qrImage, charge_id });
  } catch (error) {
    console.error('Error generating QR:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

app.post('/api/payment/webhook', async (req, res) => {
  try {
    // In a real scenario, you'd verify the webhook signature here
    // e.g. using Omise or GBPrimePay headers.
    const { charge_id, status } = req.body;

    if (!charge_id || status !== 'successful') {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Find the order
    const [orders] = await db.query("SELECT * FROM orders WHERE charge_id = ?", [charge_id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found for this charge_id' });
    }

    // Update payment_status to 'paid'
    await db.query(
      "UPDATE orders SET payment_status = 'paid' WHERE charge_id = ?",
      [charge_id]
    );

    res.json({ success: true, message: 'Payment status updated' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.get('/api/payment/status/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;
    const [orders] = await db.query("SELECT payment_status FROM orders WHERE order_id = ?", [order_id]);
    
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ success: true, payment_status: orders[0].payment_status });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Mock Google Login API
app.post('/api/auth/google-mock', async (req, res) => {
  const { email, full_name, avatar_url } = req.body;
  try {
    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    let user;
    if (users.length > 0) {
      user = users[0];
    } else {
      const dummyPassword = await bcrypt.hash('google_dummy_password', 10);
      const [result] = await db.execute(
        'INSERT INTO users (email, full_name, avatar_url, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        [email, full_name || 'Google User', avatar_url || '', dummyPassword, 'buyer']
      );
      const [newUsers] = await db.execute('SELECT * FROM users WHERE user_id = ?', [result.insertId]);
      user = newUsers[0];
    }
    res.json({ success: true, user, message: 'Google Login Success' });
  } catch (error) {
    console.error('Google Mock Login Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// Auto-cancel and refund orders pending > 10 mins
setInterval(async () => {
  try {
    const [orders] = await db.query(
        "SELECT order_id, user_id, order_type FROM orders WHERE order_status = 'pending' AND created_at < NOW() - INTERVAL 10 MINUTE"
      );

    if (orders.length > 0) {
      for (const order of orders) {
        // 1. Return stock or Restart Auction
          const [items] = await db.query("SELECT product_id, quantity, product_name FROM order_items WHERE order_id = ?", [order.order_id]);
          
          if (order.order_type === 'auction') {
            for (const item of items) {
              const title = item.product_name;
              // Restart the auction
              await db.query(`
                UPDATE auctions 
                SET auction_status = 'active', 
                    current_bid = start_price, 
                    winner_user_id = NULL,
                    end_time = DATE_ADD(NOW(), INTERVAL 30 MINUTE)
                WHERE title = ? AND auction_status = 'ended' AND winner_user_id = ?
                ORDER BY auction_id DESC LIMIT 1
              `, [title, order.user_id]);
              
              const [aucRows] = await db.query("SELECT auction_id FROM auctions WHERE title = ? AND auction_status = 'active' ORDER BY auction_id DESC LIMIT 1", [title]);
              if (aucRows.length > 0) {
                await db.query("DELETE FROM auction_bids WHERE auction_id = ?", [aucRows[0].auction_id]);
              }
            }
          } else {
            for (const item of items) {
              if (item.product_id) {
                await db.query(
                  "UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?",
                  [item.quantity, item.product_id]
                );
              }
            }
          }
        
        // 2. Notify customer with refund flag
        const msg = 'ออเดอร์ถูกยกเลิกเนื่องจากร้านค้าไม่ตอบรับภายใน 10 นาที กดที่นี่เพื่อขอคืนเงิน';
        await db.query(
          "INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, 'ออเดอร์ถูกยกเลิก (ขอคืนเงิน)', ?, 'refund_request', ?, 0, NOW())",
          [order.user_id, msg, order.order_id]
        );
        
        // 3. Update order status instead of delete
        await db.query("UPDATE deliveries SET status = 'cancelled' WHERE order_id = ?", [order.order_id]);
        await db.query("UPDATE orders SET order_status = 'cancelled' WHERE order_id = ?", [order.order_id]);
        
        console.log(`❌ ยกเลิกออเดอร์ที่หมดเวลา (10 นาที) Order ID: ${order.order_id}`);
      }
    }
  } catch (error) {
    console.error('Auto-cancel cron error:', error.message);
  }
}, 60 * 1000); // Check every 1 minute


// ------------------- REFUND SYSTEM API -------------------
app.post('/api/refund-request', upload.single('slip_image'), async (req, res) => {
  const { user_id, order_id, bank_name, account_number, account_name } = req.body;
  if (!user_id || !order_id || !bank_name || !account_number || !account_name) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  const slip_image = req.file ? req.file.filename : null;

  try {
    // Check if order exists and is cancelled
    const [orders] = await db.query("SELECT total_amount, delivery_fee, order_status FROM orders WHERE order_id = ?", [order_id]);
    if (orders.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });
    
    // Calculate total refund
    // total_amount already includes delivery fee and discounts based on our insert logic
    const amountToRefund = Number(orders[0].total_amount);

    // Create refund request table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS refund_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        order_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        bank_name VARCHAR(100) NOT NULL,
        account_number VARCHAR(100) NOT NULL,
        account_name VARCHAR(100) NOT NULL,
        slip_image VARCHAR(255) DEFAULT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Check for duplicate request
    const [existing] = await db.query("SELECT id FROM refund_requests WHERE order_id = ?", [order_id]);
    if (existing.length > 0) return res.status(400).json({ success: false, message: 'คุณได้ส่งคำขอคืนเงินสำหรับออเดอร์นี้ไปแล้ว' });

    // Insert request
    await db.query(
      "INSERT INTO refund_requests (user_id, order_id, amount, bank_name, account_number, account_name, slip_image) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [user_id, order_id, amountToRefund, bank_name, account_number, account_name, slip_image]
    );

    res.json({ success: true, message: 'ส่งคำขอคืนเงินสำเร็จ' });
  } catch (error) {
    console.error('Refund request error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin get refunds
app.get('/api/admin/refunds', async (req, res) => {
  try {
    const [refunds] = await db.query(`
      SELECT r.*, u.full_name, u.phone 
      FROM refund_requests r 
      LEFT JOIN users u ON r.user_id = u.user_id 
      ORDER BY r.created_at DESC
    `);
    res.json({ success: true, data: refunds });
  } catch (error) {
    console.error('Get refunds error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin update refund status
app.put('/api/admin/refund-status/:id', async (req, res) => {
  const { status } = req.body;
  try {
    await db.query("UPDATE refund_requests SET status = ? WHERE id = ?", [status, req.params.id]);
    res.json({ success: true, message: 'อัปเดตสถานะสำเร็จ' });
  } catch (error) {
    console.error('Update refund status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// ---------------------------------------------------------



app.get('/api/admin/orders', async (req, res) => {
  try {
    const connection = await db.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT o.*, 
               u.full_name as buyer_name, 
               COALESCE(
                 (
                   SELECT GROUP_CONCAT(DISTINCT s.name SEPARATOR ', ')
                   FROM order_items oi
                   LEFT JOIN products p ON oi.product_id = p.product_id
                   JOIN shops s ON s.shop_id = COALESCE(oi.shop_id, p.shop_id)
                   WHERE oi.order_id = o.order_id
                 ),
                 s_fallback.name
               ) as shop_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.user_id
        LEFT JOIN shops s_fallback ON o.shop_id = s_fallback.shop_id
        ORDER BY o.created_at DESC
      `);
      res.json({ success: true, orders: rows });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('API /api/admin/orders error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server is running on port ' + PORT);
});


// Rider Withdraw API
app.post('/api/rider/wallet/withdraw', async (req, res) => {
  const { rider_id, amount } = req.body;
  if (!rider_id || !amount) return res.status(400).json({ success: false, message: 'Missing fields' });
  
  try {
    const [delivs] = await db.query("SELECT SUM(o.delivery_fee) as earned FROM deliveries d JOIN orders o ON d.order_id = o.order_id WHERE d.rider_id = ? AND d.status = 'delivered'", [rider_id]);
    const [withdraws] = await db.query("SELECT SUM(amount) as withdrawn FROM wallet_transactions WHERE user_type = 'rider' AND target_id = ? AND type = 'debit'", [rider_id]);
    const [pendingW] = await db.query("SELECT SUM(amount) as p_amount FROM withdrawals WHERE user_type = 'rider' AND rider_id = ? AND status = 'pending'", [rider_id]);
    const pendingWithdrawn = pendingW[0]?.p_amount || 0;
    
    const earned = delivs[0].earned || 0;
    const withdrawn = withdraws[0].withdrawn || 0;
    const balance = Number(earned) - Number(withdrawn) - Number(pendingWithdrawn);
    
    if (balance < amount) {
      return res.status(400).json({ success: false, message: 'ยอดเงินไม่เพียงพอ' });
    }

    await db.query("INSERT INTO withdrawals (user_type, rider_id, amount, status) VALUES ('rider', ?, ?, 'pending')", [rider_id, amount]);
    
    res.json({ success: true, message: 'ถอนเงินสำเร็จ' });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});






// Notifications API
app.get('/api/seller/notifications/:shopId', async (req, res) => {
  const { shopId } = req.params;
  try {
    const [reviews] = await db.execute(
      'SELECT r.*, u.full_name as customer_name, p.name as product_name FROM reviews r LEFT JOIN users u ON r.user_id = u.user_id LEFT JOIN products p ON r.product_id = p.product_id WHERE r.shop_id = ? ORDER BY r.created_at DESC LIMIT 50',
      [shopId]
    );
    const formattedReviews = reviews.map(r => ({
        id: r.review_id,
        title: 'มีลูกค้ารีวิวสินค้า',
        body: `ลูกค้า ${r.customer_name || 'ไม่ระบุชื่อ'} รีวิวสินค้า "${r.product_name || 'สินค้า'}" ${r.rating} ดาว : ${r.comment || 'ไม่มีคอมเมนต์'}`,
        type: 'review',
        created_at: r.created_at
      }));

      // Fetch actual notifications for this shop owner
      const [shopRows] = await db.execute('SELECT owner_id FROM shops WHERE shop_id = ?', [shopId]);
      let realNotifs = [];
      if (shopRows.length > 0 && shopRows[0].owner_id) {
        const [nRows] = await db.execute('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [shopRows[0].owner_id]);
        realNotifs = nRows.map(n => ({
          id: 'n_' + n.notification_id,
          title: n.title,
          body: n.message,
          type: n.type,
          created_at: n.created_at
        }));
      }

      const combined = [...formattedReviews, ...realNotifs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      res.json({ success: true, notifications: combined });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

