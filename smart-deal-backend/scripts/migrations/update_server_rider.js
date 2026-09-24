const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '../../src/server.js');
let serverCode = fs.readFileSync(serverPath, 'utf8');

const riderApiCode = `
// ==========================================
// RIDER APIS
// ==========================================

// 1. Rider Register
app.post('/api/rider/register', upload.single('license_image'), async (req, res) => {
  const { full_name, phone, vehicle_plate, password } = req.body;
  if (!full_name || !phone || !vehicle_plate || !password) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  const license_image = req.file ? \`/uploads/\${req.file.filename}\` : '';

  try {
    // Check if phone already exists in users
    const [existing] = await db.query('SELECT * FROM users WHERE phone = ?', [phone]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว' });
    }

    // Insert user
    const [userResult] = await db.query(
      'INSERT INTO users (full_name, phone, password, role) VALUES (?, ?, ?, "rider")',
      [full_name, phone, password] // In production, hash the password
    );
    const userId = userResult.insertId;

    // Insert rider
    await db.query(
      'INSERT INTO riders (user_id, vehicle_plate, license_image) VALUES (?, ?, ?)',
      [userId, vehicle_plate, license_image]
    );

    res.json({ success: true, message: 'สมัครสมาชิกไรเดอร์สำเร็จ รอการอนุมัติ' });
  } catch (error) {
    console.error('Rider register error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดเซิร์ฟเวอร์' });
  }
});

// 2. Rider Login
app.post('/api/rider/login', async (req, res) => {
  const { phone, password } = req.body;
  try {
    const [users] = await db.query('SELECT * FROM users WHERE phone = ? AND password = ? AND role = "rider"', [phone, password]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = users[0];
    const [riders] = await db.query('SELECT * FROM riders WHERE user_id = ?', [user.id]);
    
    if (riders.length === 0) {
      return res.status(401).json({ success: false, message: 'ไม่พบข้อมูลไรเดอร์' });
    }

    const rider = riders[0];
    if (rider.status === 'pending') {
      return res.status(403).json({ success: false, message: 'บัญชีของคุณอยู่ระหว่างการรออนุมัติ' });
    }
    if (rider.status === 'rejected') {
      return res.status(403).json({ success: false, message: 'บัญชีของคุณถูกปฏิเสธการใช้งาน' });
    }

    res.json({
      success: true,
      data: {
        id: rider.id,
        user_id: user.id,
        full_name: user.full_name,
        phone: user.phone,
        vehicle_plate: rider.vehicle_plate,
        status: rider.status
      }
    });
  } catch (error) {
    console.error('Rider login error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดเซิร์ฟเวอร์' });
  }
});

// 3. Get Nearby Jobs
app.get('/api/rider/jobs', async (req, res) => {
  const { lat, lng } = req.query;
  // If lat/lng provided, we can use Haversine formula. 
  // For simplicity, we just fetch orders that are ready or finding_rider
  try {
    const [orders] = await db.query(\`
      SELECT o.id as order_id, o.total_amount, o.delivery_fee, o.order_status, o.created_at,
             s.id as shop_id, s.name as shop_name, s.latitude as shop_lat, s.longitude as shop_lng, s.address as shop_address,
             u.full_name as customer_name, u.phone as customer_phone, o.shipping_address as customer_address
      FROM orders o
      JOIN shop_profiles s ON o.shop_id = s.id
      JOIN users u ON o.user_id = u.id
      WHERE o.order_status IN ('finding_rider', 'ready', 'paid') AND o.delivery_type != 'pickup'
      ORDER BY o.created_at ASC
    \`);
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดเซิร์ฟเวอร์' });
  }
});

// 4. Update Delivery Status (Accept Job, Picking up, Delivering)
app.put('/api/rider/deliveries/:order_id/status', async (req, res) => {
  const orderId = req.params.order_id;
  const { rider_id, status } = req.body;
  
  try {
    // If accepting the job, we create a record in deliveries table
    if (status === 'accepted') {
      // Check if order is already taken
      const [existingDeliveries] = await db.query('SELECT * FROM deliveries WHERE order_id = ?', [orderId]);
      if (existingDeliveries.length > 0) {
         return res.status(400).json({ success: false, message: 'ออเดอร์นี้ถูกรับไปแล้ว' });
      }

      await db.query(
        'INSERT INTO deliveries (order_id, rider_id, status) VALUES (?, ?, ?)',
        [orderId, rider_id, 'accepted']
      );

      // Update order status
      await db.query('UPDATE orders SET order_status = "delivering" WHERE id = ?', [orderId]);
      return res.json({ success: true, message: 'รับงานสำเร็จ' });
    }

    // For other statuses (picking_up, delivering)
    await db.query('UPDATE deliveries SET status = ? WHERE order_id = ? AND rider_id = ?', [status, orderId, rider_id]);
    res.json({ success: true, message: 'อัปเดตสถานะสำเร็จ' });
  } catch (error) {
    console.error('Update delivery status error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดเซิร์ฟเวอร์' });
  }
});

// 5. Proof & Confirm (Complete Delivery)
app.post('/api/rider/deliveries/:order_id/complete', upload.single('proof_image'), async (req, res) => {
  const orderId = req.params.order_id;
  const { rider_id } = req.body;
  const proof_image = req.file ? \`/uploads/\${req.file.filename}\` : '';

  try {
    await db.query(
      'UPDATE deliveries SET status = "delivered", proof_image = ?, completed_at = NOW() WHERE order_id = ? AND rider_id = ?',
      [proof_image, orderId, rider_id]
    );

    // Don't mark order as completed yet, wait for user to confirm receipt via escrow, or auto complete it?
    // Based on food delivery standard, rider delivers -> status = delivered/shipped. User confirms -> completed.
    await db.query('UPDATE orders SET order_status = "shipped" WHERE id = ?', [orderId]);

    res.json({ success: true, message: 'ยืนยันการจัดส่งสำเร็จ' });
  } catch (error) {
    console.error('Complete delivery error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดเซิร์ฟเวอร์' });
  }
});

// 6. Rider Earnings History
app.get('/api/rider/:id/history', async (req, res) => {
  const riderId = req.params.id;
  try {
    const [deliveries] = await db.query(\`
      SELECT d.id as delivery_id, d.status, d.completed_at, d.proof_image,
             o.id as order_id, o.delivery_fee,
             s.name as shop_name
      FROM deliveries d
      JOIN orders o ON d.order_id = o.id
      JOIN shop_profiles s ON o.shop_id = s.id
      WHERE d.rider_id = ? AND d.status = 'delivered'
      ORDER BY d.completed_at DESC
    \`, [riderId]);

    const total_earnings = deliveries.reduce((sum, item) => sum + Number(item.delivery_fee || 0), 0);

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
`;

if (!serverCode.includes('/api/rider/jobs')) {
  // Find a good place to insert, right before the chat apis or error handler
  const insertIndex = serverCode.lastIndexOf('// Error handling middleware');
  if (insertIndex !== -1) {
    serverCode = serverCode.slice(0, insertIndex) + riderApiCode + '\\n' + serverCode.slice(insertIndex);
    fs.writeFileSync(serverPath, serverCode);
    console.log('Rider APIs successfully injected into server.js');
  } else {
    // Append to end if not found
    fs.writeFileSync(serverPath, serverCode + '\\n' + riderApiCode);
    console.log('Rider APIs appended to the end of server.js');
  }
} else {
  console.log('Rider APIs already exist in server.js');
}
