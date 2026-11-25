const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'smart_deal_db'});
  const [settings] = await conn.query("SELECT setting_value FROM system_settings WHERE setting_key='platform_fee_percent'");
  const gp = settings[0] ? parseFloat(settings[0].setting_value) : 0;
  const gpMult = 1 - (gp/100);
  const [o] = await conn.query('SELECT order_id as id, subtotal, (subtotal * ?) as amount, created_at, "sale" as type FROM orders WHERE shop_id = 1 AND order_status = "completed" ORDER BY created_at DESC LIMIT 5', [gpMult]);
  console.log('Orders query result:', o);
  conn.end();
}
run().catch(console.error);
