const fs = require('fs');
const file = 'c:/smartdeal/smart-deal-backend/src/server.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Migration
if (!content.includes('ADD COLUMN shop_id INT DEFAULT NULL')) {
  content = content.replace(
    "try { await db.execute('ALTER TABLE order_messages ADD COLUMN image_url LONGTEXT NULL'); } catch(e) {}",
    "try { await db.execute('ALTER TABLE order_messages ADD COLUMN image_url LONGTEXT NULL'); } catch(e) {}\n    try { await db.execute('ALTER TABLE order_messages ADD COLUMN shop_id INT DEFAULT NULL'); } catch(e) {}"
  );
}

// 2. Patch POST API
if (!content.includes('const shop_id = req.body.shop_id')) {
  content = content.replace(
    "const { sender_id, sender_type, message } = req.body;",
    "const { sender_id, sender_type, message } = req.body;\n  const shop_id = req.body.shop_id || null;"
  );
  content = content.replace(
    "'INSERT INTO order_messages (order_id, sender_id, sender_type, receiver_type, message, image_url) VALUES (?, ?, ?, ?, ?, ?)',",
    "'INSERT INTO order_messages (order_id, sender_id, sender_type, receiver_type, message, image_url, shop_id) VALUES (?, ?, ?, ?, ?, ?, ?)',"
  );
  content = content.replace(
    "[orderId, sender_id, sender_type, receiver_type, message || '', image_url || null]",
    "[orderId, sender_id, sender_type, receiver_type, message || '', image_url || null, shop_id]"
  );
}

// 3. Patch GET API
if (!content.includes("const shop_id = req.query.shop_id;")) {
  content = content.replace(
    "const target = req.query.target || req.query.channel;",
    "const target = req.query.target || req.query.channel;\n  const shop_id = req.query.shop_id;"
  );
  content = content.replace(
    "query += ' AND ((sender_type = \"buyer\" AND receiver_type = \"seller\") OR (sender_type = \"seller\" AND receiver_type = \"buyer\"))';",
    "query += ' AND ((sender_type = \"buyer\" AND receiver_type = \"seller\") OR (sender_type = \"seller\" AND receiver_type = \"buyer\"))';\n      if (shop_id) { query += ' AND shop_id = ?'; params.push(shop_id); }"
  );
}

fs.writeFileSync(file, content, 'utf8');
console.log('Patched order_messages API');
