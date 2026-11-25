const fs = require('fs');
let content = fs.readFileSync('C:/smartdeal/server.js', 'utf8');

const newApi = 
app.get('/api/admin/shops/:id/insights', async (req, res) => {
  const shopId = req.params.id;
  try {
    const [shopInfo] = await db.execute('SELECT s.*, u.full_name AS owner_name, u.phone AS owner_phone, u.email AS owner_email FROM shops s LEFT JOIN users u ON s.owner_id = u.user_id WHERE s.shop_id = ?', [shopId]);
    
    if (shopInfo.length === 0) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const [salesKpi] = await db.execute('SELECT COUNT(order_id) AS total_orders, SUM(total_amount) AS total_revenue FROM orders WHERE shop_id = ? AND order_status IN (\"completed\", \"paid\")', [shopId]);
    
    const [products] = await db.execute('SELECT product_id, name, price, stock, image_url, expiration_date FROM products WHERE shop_id = ? ORDER BY created_at DESC LIMIT 5', [shopId]);
    
    const [weeklyChart] = await db.execute('SELECT DATE_FORMAT(created_at, \"%d %b\") AS date, SUM(total_amount) AS total FROM orders WHERE shop_id = ? AND order_status IN (\"completed\", \"paid\") AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY DATE(created_at) ORDER BY DATE(created_at)', [shopId]);

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
;

content = content.replace('// Dashboard Stats', newApi);
fs.writeFileSync('C:/smartdeal/server.js', content, 'utf8');
