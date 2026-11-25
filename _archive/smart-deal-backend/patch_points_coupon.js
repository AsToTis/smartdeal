const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'server.js');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add POST /api/points/redeem and GET /api/coupons/:userId right after GET /api/points/:userId
const pointsGetMarker = "app.get('/api/points/:userId', async (req, res) => {";
const pointsEndMarker = "});\n\n// ==========================================\n// 1.1 USER PROFILE & ACCOUNT APIs";
const pointsEndMarkerCRLF = "});\r\n\r\n// ==========================================\r\n// 1.1 USER PROFILE & ACCOUNT APIs";

const pointsNewAPIs = `

// แลกของรางวัล / คูปองด้วยคะแนนสะสม (POST /api/points/redeem)
app.post('/api/points/redeem', async (req, res) => {
  const { user_id, cost, code, title, type, value } = req.body;
  if (!user_id || !cost) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุ user_id และจำนวนคะแนน' });
  }

  try {
    try {
      await db.execute(\`
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
      \`);
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
      [user_id, \`แลก \${title}\`, \`-\${cost}\`]
    );

    const [insertCoupon] = await db.execute(
      'INSERT INTO user_coupons (user_id, code, title, type, value, is_used) VALUES (?, ?, ?, ?, ?, 0)',
      [user_id, code || 'DISCOUNT', title || 'ส่วนลด', type || 'discount', value || 50]
    );

    res.json({
      success: true,
      message: \`แลกรับ \${title} สำเร็จ!\`,
      points: newPoints,
      coupon: {
        id: insertCoupon.insertId,
        code: code || 'DISCOUNT',
        title: title || 'ส่วนลด',
        type: type || 'discount',
        value: value || 50
      }
    });
  } catch (error) {
    console.error('❌ POST /api/points/redeem error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ดึงคูปองของผู้ใช้ที่ยังไม่ได้ใช้งาน (GET /api/coupons/:userId)
app.get('/api/coupons/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    try {
      await db.execute(\`
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
      \`);
    } catch(e) {}

    const [coupons] = await db.execute(
      'SELECT id, code, title, type, value, is_used, created_at FROM user_coupons WHERE user_id = ? AND is_used = 0 ORDER BY id DESC',
      [userId]
    );

    res.json({
      success: true,
      coupons: coupons
    });
  } catch (error) {
    console.error(\`❌ GET /api/coupons/\${userId} error:\`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
`;

if (code.includes("// 1.1 USER PROFILE & ACCOUNT APIs") && !code.includes("app.post('/api/points/redeem'")) {
  code = code.replace("// 1.1 USER PROFILE & ACCOUNT APIs", pointsNewAPIs + "\n// 1.1 USER PROFILE & ACCOUNT APIs");
}

// 2. Update POST /api/orders to mark coupon as used and award points
const orderCommitTarget = "await connection.commit();\n    console.log(`✅ สั่งซื้อและตัดสต็อกสินค้าสำเร็จสำหรับ Order ID: ${orderId}`);";
const orderCommitTargetCRLF = "await connection.commit();\r\n    console.log(`✅ สั่งซื้อและตัดสต็อกสินค้าสำเร็จสำหรับ Order ID: ${orderId}`);";

const orderCouponUpdate = `
    // 4. บันทึกการใช้งานคูปอง (ถ้ามี)
    if (req.body.coupon_id) {
      await connection.query('UPDATE user_coupons SET is_used = 1 WHERE id = ?', [req.body.coupon_id]);
    } else if (req.body.coupon_code && user_id) {
      await connection.query('UPDATE user_coupons SET is_used = 1 WHERE code = ? AND user_id = ? LIMIT 1', [req.body.coupon_code, user_id]);
    }

    // 5. ให้คะแนนสะสมจากการสั่งซื้อ (+1 พอยท์ ทุกๆ 10 บาท)
    const earnedPoints = Math.max(5, Math.floor((total_amount || 0) / 10));
    try {
      await connection.query('UPDATE user_points SET points = points + ? WHERE user_id = ?', [earnedPoints, user_id || 2]);
      await connection.query('INSERT INTO user_point_history (user_id, title, points_change) VALUES (?, ?, ?)', [
        user_id || 2,
        \`คะแนนจากการสั่งซื้อ #\${orderId}\`,
        \`+\${earnedPoints}\`
      ]);
    } catch(e) {}
`;

if (code.includes(orderCommitTarget)) {
  code = code.replace(orderCommitTarget, orderCouponUpdate + "\n    " + orderCommitTarget);
} else if (code.includes(orderCommitTargetCRLF)) {
  code = code.replace(orderCommitTargetCRLF, orderCouponUpdate + "\r\n    " + orderCommitTargetCRLF);
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('✅ Points & Coupon APIs patched in server.js successfully!');
