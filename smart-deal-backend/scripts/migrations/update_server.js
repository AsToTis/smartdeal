const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

// 1. Replace POST /api/shops/register
const registerStartIndex = content.indexOf('app.post(\'/api/shops/register\'');
const registerEndIndex = content.indexOf('app.get(\'/api/shops\'', registerStartIndex);

if (registerStartIndex !== -1 && registerEndIndex !== -1) {
  const newRegisterApi = `app.post('/api/shops/register', async (req, res) => {
  const { owner_id, name, description, category_id, address, latitude, longitude, bank_name, bank_account, id_card_image, bookbank_image } = req.body;
  
  if (!owner_id || !name || !address) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  try {
    const [check] = await db.execute('SELECT shop_id FROM shops WHERE owner_id = ?', [owner_id]);
    if (check.length > 0) {
      return res.status(400).json({ success: false, message: 'คุณมีร้านค้าอยู่แล้ว' });
    }

    const [result] = await db.execute(
      \`INSERT INTO shops (owner_id, name, description, category_id, address, latitude, longitude, bank_name, bank_account, id_card_image, bookbank_image, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')\`, 
      [owner_id, name, description || null, category_id || null, address, latitude || null, longitude || null, bank_name || null, bank_account || null, id_card_image || null, bookbank_image || null]
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

`;
  content = content.substring(0, registerStartIndex) + newRegisterApi + content.substring(registerEndIndex);
}

// 2. Add Admin APIs
const adminApiCode = `
// ==========================================
// ADMIN API
// ==========================================
app.get('/api/admin/shops/pending', async (req, res) => {
  try {
    const [shops] = await db.execute('SELECT * FROM shops WHERE status = "pending" ORDER BY created_at DESC');
    res.json({ success: true, shops });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/shops/:shopId/approve', async (req, res) => {
  try {
    const [result] = await db.execute('UPDATE shops SET status = "approved" WHERE shop_id = ?', [req.params.shopId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ไม่พบร้านค้า' });
    res.json({ success: true, message: 'อนุมัติร้านค้าเรียบร้อยแล้ว' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/shops/:shopId/reject', async (req, res) => {
  const { reason } = req.body;
  try {
    const [result] = await db.execute('UPDATE shops SET status = "rejected", reject_reason = ? WHERE shop_id = ?', [reason || null, req.params.shopId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ไม่พบร้านค้า' });
    res.json({ success: true, message: 'ปฏิเสธร้านค้าเรียบร้อยแล้ว' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

`;

const insertPos = content.indexOf('// ==========================================\n// START SERVER');
if (insertPos !== -1) {
  content = content.substring(0, insertPos) + adminApiCode + content.substring(insertPos);
} else {
  // Fallback
  content += adminApiCode;
}

fs.writeFileSync('server.js', content);
console.log('server.js updated successfully with Register and Admin APIs.');
