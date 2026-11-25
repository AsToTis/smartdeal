const mysql = require('mysql2/promise');
mysql.createConnection({host:'localhost', user:'root', database:'smart_deal_db'}).then(async c => {
  try {
    await c.query("ALTER TABLE deliveries CHANGE delivery_status status VARCHAR(50) DEFAULT 'assigned'");
    await c.query("ALTER TABLE deliveries CHANGE delivered_at completed_at DATETIME");
    await c.query("ALTER TABLE deliveries ADD COLUMN proof_image TEXT");
    await c.query("ALTER TABLE deliveries CHANGE delivery_id id INT AUTO_INCREMENT");
    console.log('Altered deliveries table successfully');
  } catch (e) {
    console.error('Alter failed:', e.message);
  }
  c.end();
}).catch(console.error);
