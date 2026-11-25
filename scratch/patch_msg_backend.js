const fs = require('fs');
const file = 'c:/smartdeal/smart-deal-backend/src/server.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Update GET API
content = content.replace(
  'const role = req.query.role; // \\'seller\\' | \\'rider\\' | \\'buyer\\'',
  'const role = req.query.role; // \\'seller\\' | \\'rider\\' | \\'buyer\\'\n  const shopId = req.query.shop_id;'
);

content = content.replace(
  'let query = `SELECT id, order_id, sender_id, sender_type, receiver_type, message, image_url, \n                        DATE_FORMAT(created_at, \\'%Y-%m-%dT%H:%i:%s.000Z\\') as created_at \n                 FROM order_messages \n                 WHERE order_id = ?`;',
  'let query = `SELECT id, order_id, shop_id, sender_id, sender_type, receiver_type, message, image_url, \n                        DATE_FORMAT(created_at, \\'%Y-%m-%dT%H:%i:%s.000Z\\') as created_at \n                 FROM order_messages \n                 WHERE order_id = ?`;'
);

content = content.replace(
  'query += \\' ORDER BY id ASC\\';',
  'if (shopId) {\n      query += \\' AND (shop_id = ? OR shop_id IS NULL)\\';\n      params.push(shopId);\n    }\n\n    query += \\' ORDER BY id ASC\\';'
);

// 2. Update POST API
content = content.replace(
  'const { sender_id, sender_type, message } = req.body;',
  'const { sender_id, sender_type, message, shop_id } = req.body;'
);

content = content.replace(
  'INSERT INTO order_messages (order_id, sender_id, sender_type, receiver_type, message, image_url) VALUES (?, ?, ?, ?, ?, ?)',
  'INSERT INTO order_messages (order_id, shop_id, sender_id, sender_type, receiver_type, message, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

content = content.replace(
  '[orderId, sender_id, sender_type, receiver_type, message || \\'\\', image_url || null]',
  '[orderId, shop_id || null, sender_id, sender_type, receiver_type, message || \\'\\', image_url || null]'
);

content = content.replace(
  'receiver_type,\n        message: message || \\'\\',',
  'shop_id: shop_id || null,\n        receiver_type,\n        message: message || \\'\\','
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched server.js messages API successfully');
