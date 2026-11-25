const fs = require('fs');
const file = 'c:/smartdeal/smart-deal-backend/src/server.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /app\.get\('\/api\/seller\/dashboard\/:owner_id', async \(req, res\) => \{[\s\S]*?res\.json\(\{\s*success: true,\s*shop: shop,\s*stats: stats,\s*recentOrders: formattedOrders\s*\}\);\s*\} catch \(error\) \{\s*console\.error\('API \/api\/seller\/dashboard error:', error\);\s*res\.status\(500\)\.json\(\{ success: false, error: error\.message \}\);\s*\}\s*\}\);/;

const newDashboardAPI = `app.get('/api/seller/dashboard/:owner_id', async (req, res) => {
  try {
    const owner_id = req.params.owner_id;
    
    // 1. Get Shop Info
    const [shopData] = await db.execute('SELECT shop_id, name, status, IFNULL(is_open, 1) AS is_open FROM shops WHERE owner_id = ?', [owner_id]);
    if (shopData.length === 0) {
      return res.json({ success: false, message: 'Shop not found' });
    }
    const shop = shopData[0];
    const shop_id = shop.shop_id;

    const [platformFeeRows] = await db.execute("SELECT setting_value FROM system_settings WHERE setting_key='platform_fee_percent'");
    const platform_fee = platformFeeRows.length > 0 ? parseFloat(platformFeeRows[0].setting_value) : 0;
    const fee_multiplier = 1 - (platform_fee / 100);

    // 2. Get Today's Sales (Calculate from order_items for accurate multi-shop totals)
    const [statsData] = await db.execute(\`
      SELECT 
        SUM(oi.price * oi.quantity) AS today_gross_sales, 
        COUNT(DISTINCT o.order_id) AS today_orders 
      FROM orders o
      JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.product_id
      WHERE (oi.shop_id = ? OR p.shop_id = ?)
        AND DATE(o.created_at) = CURDATE() 
        AND o.order_status IN ('completed', 'paid', 'delivered', 'shipped')
    \`, [shop_id, shop_id]);
    
    const gross_sales = parseFloat(statsData[0].today_gross_sales || 0);
    const today_sales_net = gross_sales * fee_multiplier;

    const stats = {
      today_sales: today_sales_net,
      today_orders: statsData[0].today_orders || 0
    };

    // 3. Get Recent Orders (Calculate total_amount per shop)
    const [recentOrders] = await db.execute(\`
      SELECT 
        o.order_id, 
        o.order_status, 
        DATE_FORMAT(o.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,
        SUM(oi.price * oi.quantity) AS shop_subtotal,
        (SELECT oi2.product_name FROM order_items oi2 LEFT JOIN products p2 ON oi2.product_id = p2.product_id WHERE oi2.order_id = o.order_id AND (oi2.shop_id = ? OR p2.shop_id = ?) LIMIT 1) as product_name,
        (SELECT COALESCE(p2.image_url, (SELECT image_url FROM auctions WHERE title COLLATE utf8mb4_unicode_ci = oi2.product_name COLLATE utf8mb4_unicode_ci LIMIT 1)) FROM order_items oi2 LEFT JOIN products p2 ON oi2.product_id = p2.product_id WHERE oi2.order_id = o.order_id AND (oi2.shop_id = ? OR p2.shop_id = ?) LIMIT 1) as image_url
      FROM orders o
      JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.product_id
      WHERE (oi.shop_id = ? OR p.shop_id = ?)
      GROUP BY o.order_id, o.order_status, o.created_at
      ORDER BY o.created_at DESC 
      LIMIT 5
    \`, [shop_id, shop_id, shop_id, shop_id, shop_id, shop_id]);

    const formattedOrders = recentOrders.map(row => ({
      order_id: row.order_id,
      total_amount: parseFloat(row.shop_subtotal || 0) * fee_multiplier,
      order_status: row.order_status,
      created_at: row.created_at,
      image_url: row.image_url,
      product_name: row.product_name
    }));

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
});`;

if (content.match(regex)) {
  content = content.replace(regex, newDashboardAPI);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully patched seller dashboard API for multi-shop support');
} else {
  console.log('Failed to find exact seller dashboard API block');
}
