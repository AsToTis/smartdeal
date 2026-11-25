const fs = require('fs');
let code = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8');

const api = `
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
      title: 'รีวิวใหม่จากลูกค้า',
      body: \`ลูกค้า \${r.customer_name || 'ไม่ระบุชื่อ'} รีวิวสินค้า "\${r.product_name || 'สินค้า'}" \${r.rating} ดาว: \${r.comment || 'ไม่มีคอมเมนต์'}\`,
      type: 'review',
      created_at: r.created_at
    }));
    res.json({ success: true, notifications: formattedReviews });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
`;

code += api;
fs.writeFileSync('c:/smartdeal/smart-deal-backend/src/server.js', code);
console.log('Appended API successfully');
