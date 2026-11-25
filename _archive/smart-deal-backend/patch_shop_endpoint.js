const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'server.js');
let code = fs.readFileSync(filePath, 'utf8');

// Replace /api/shops/nearby and add /api/shops/:shopId
const nearbyTarget = `app.get('/api/shops/nearby', async (req, res) => {
  try {
    const [shops] = await db.execute('SELECT shop_id, name, image_url, rating, distance, tag1, tag2 FROM shops ORDER BY shop_id ASC LIMIT 10');
    res.json(shops);
  } catch (error) {
    console.error('API /api/shops/nearby error:', error);
    res.status(500).json({ error: error.message });
  }
});`;

const nearbyReplacement = `app.get('/api/shops/nearby', async (req, res) => {
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
    const [rows] = await db.execute(\`
      SELECT 
        s.*, 
        IFNULL(s.is_open, 1) AS is_open,
        u.full_name AS owner_name, 
        u.phone AS owner_phone 
      FROM shops s 
      LEFT JOIN users u ON s.owner_id = u.user_id 
      WHERE s.shop_id = ?
    \`, [shopId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }
    
    res.json({ success: true, shop: rows[0] });
  } catch (error) {
    console.error(\`❌ GET /api/shops/\${shopId} error:\`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});`;

if (code.includes(nearbyTarget)) {
  code = code.replace(nearbyTarget, nearbyReplacement);
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('✅ Added GET /api/shops/:shopId successfully!');
} else {
  console.log('Target not found directly, finding with regex...');
  const idx = code.indexOf("app.get('/api/shops/nearby'");
  const nextIdx = code.indexOf("app.get('/api/shops/:shopId/stats'");
  if (idx !== -1 && nextIdx !== -1) {
    code = code.substring(0, idx) + nearbyReplacement + '\n' + code.substring(nextIdx);
    fs.writeFileSync(filePath, code, 'utf8');
    console.log('✅ Added GET /api/shops/:shopId via slice!');
  }
}
