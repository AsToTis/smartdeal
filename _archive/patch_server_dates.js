const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'smart-deal-backend/src/server.js');
let code = fs.readFileSync(serverFile, 'utf8');

// In GET /api/orders/:orderId, format created_at
code = code.replace(
  /SELECT \s*orders\.\*,/m,
  "SELECT orders.*, DATE_FORMAT(orders.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,"
);

// In GET /api/seller/dashboard/:owner_id, format created_at
code = code.replace(
  /o\.order_id, \(o\.subtotal \* \(1 - \(SELECT setting_value FROM system_settings WHERE setting_key='platform_fee_percent'\) \/ 100\)\) as total_amount, o\.order_status, o\.created_at,/m,
  "o.order_id, (o.subtotal * (1 - (SELECT setting_value FROM system_settings WHERE setting_key='platform_fee_percent') / 100)) as total_amount, o.order_status, DATE_FORMAT(o.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,"
);

// In GET /api/shops/:shopId/orders, format created_at
code = code.replace(
  /SELECT \s*o\.\*,/m,
  "SELECT o.*, DATE_FORMAT(o.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,"
);

fs.writeFileSync(serverFile, code, 'utf8');
console.log('✅ server.js date formatting patched');
