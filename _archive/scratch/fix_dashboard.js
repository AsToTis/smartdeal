const fs = require('fs');
let code = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8');

const targetStr = `SELECT o.order_id, o.subtotal as total_amount, o.order_status, o.created_at, oi.product_id, p.image_url, p.name as product_name`;
const replacementStr = `SELECT o.order_id, (o.subtotal * (1 - (SELECT setting_value FROM system_settings WHERE setting_key='platform_fee_percent') / 100)) as total_amount, o.order_status, o.created_at, oi.product_id, p.image_url, p.name as product_name`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('c:/smartdeal/smart-deal-backend/src/server.js', code);
console.log('Fixed dashboard recent orders in server.js');
