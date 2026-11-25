const fs = require('fs');
const file = 'src/server.js';
let content = fs.readFileSync(file, 'utf8');

// Fix dashboard today_sales query
const oldStatsQuery = `    // 2. Get Today's Sales
    const [statsData] = await db.execute(\`
      SELECT SUM(subtotal) AS today_sales, SUM(subtotal * (SELECT setting_value FROM system_settings WHERE setting_key='platform_fee_percent') / 100) AS total_gp, COUNT(order_id) AS today_orders 
      FROM orders 
      WHERE shop_id = ? AND DATE(created_at) = CURDATE() AND order_status IN ('completed', 'paid', 'delivered', 'shipped')
    \`, [shop_id]);`;

const newStatsQuery = `    // 2. Get Today's Sales
    // Use JS to determine start of today in local timezone (Thailand UTC+7) to avoid DB timezone issues
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [statsData] = await db.execute(\`
      SELECT subtotal, created_at, (subtotal * (SELECT setting_value FROM system_settings WHERE setting_key='platform_fee_percent') / 100) AS gp 
      FROM orders 
      WHERE shop_id = ? AND order_status IN ('completed', 'paid', 'delivered', 'shipped', 'delivering')
      ORDER BY created_at DESC LIMIT 500
    \`, [shop_id]);
    
    let today_sales = 0;
    let total_gp = 0;
    let today_orders = 0;
    
    statsData.forEach(row => {
      const orderDate = new Date(row.created_at);
      if (orderDate >= today) {
        today_sales += parseFloat(row.subtotal) || 0;
        total_gp += parseFloat(row.gp) || 0;
        today_orders++;
      }
    });

    // Mock statsData to fit old format
    statsData[0] = { today_sales, total_gp, today_orders };
`;

content = content.replace(oldStatsQuery, newStatsQuery);

fs.writeFileSync(file, content);
console.log('Fixed dashboard today_sales logic');
