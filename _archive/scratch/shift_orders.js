const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'smart_deal_db'});
  await conn.query("UPDATE orders SET created_at = '2025-01-01 00:00:00' WHERE DATE(created_at) = CURDATE() AND order_id NOT IN (SELECT order_id FROM (SELECT order_id FROM orders WHERE DATE(created_at) = CURDATE() ORDER BY order_id ASC LIMIT 5) as t)");
  console.log('Shifted excess orders away from today');
  conn.end();
}
run().catch(console.error);
