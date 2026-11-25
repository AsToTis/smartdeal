const fs = require('fs');

function fixBackendImages() {
  const file = 'src/server.js';
  let content = fs.readFileSync(file, 'utf8');

  // Replace order items queries
  const oldQuery = `SELECT oi.*, p.name AS db_product_name, p.image_url AS product_image
         FROM order_items oi`;
  const newQuery = `SELECT oi.*, p.name AS db_product_name, COALESCE(p.image_url, (SELECT image_url FROM auctions WHERE title = oi.product_name LIMIT 1)) AS product_image
         FROM order_items oi`;
  
  // Note: There are a few different indentation variations, so let's use regex
  const regexQuery = /SELECT oi\.\*, p\.name AS db_product_name, p\.image_url AS product_image\s+FROM order_items oi/g;
  content = content.replace(regexQuery, "SELECT oi.*, p.name AS db_product_name, COALESCE(p.image_url, (SELECT image_url FROM auctions WHERE title = oi.product_name LIMIT 1)) AS product_image\n         FROM order_items oi");

  // Fix seller dashboard recent orders
  const oldSellerDashboardQuery = /SELECT o\.order_id, \(o\.subtotal \* \(1 - \(SELECT setting_value FROM system_settings WHERE setting_key='platform_fee_percent'\) \/ 100\)\) as total_amount, o\.order_status, o\.created_at, oi\.product_id, p\.image_url, p\.name as product_name\s+FROM orders o/g;
  
  const newSellerDashboardQuery = `SELECT o.order_id, (o.subtotal * (1 - (SELECT setting_value FROM system_settings WHERE setting_key='platform_fee_percent') / 100)) as total_amount, o.order_status, o.created_at, oi.product_id, COALESCE(p.image_url, (SELECT image_url FROM auctions WHERE title = oi.product_name LIMIT 1)) as image_url, COALESCE(p.name, oi.product_name) as product_name
        FROM orders o`;

  content = content.replace(oldSellerDashboardQuery, newSellerDashboardQuery);

  // Fix GET /api/shops/:shopId/orders query
  const oldShopOrdersQuery = /SELECT o\.\*, u\.full_name AS customer_name, u\.phone AS customer_phone\s+FROM orders o/g;
  // This one already fetches order items separately via a loop, which uses the first regex.

  fs.writeFileSync(file, content);
  console.log('Fixed backend image SQL queries');
}

fixBackendImages();
