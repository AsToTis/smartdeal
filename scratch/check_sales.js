const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'smart_deal_db'});
  const [o] = await conn.query("SELECT COUNT(*) as c FROM orders WHERE shop_id = 1 AND DATE(created_at) = CURDATE() AND order_status IN ('completed', 'paid', 'delivered', 'shipped')");
  console.log('Today orders:', o);
  
  const [sales] = await conn.query("SELECT SUM(subtotal) as s FROM orders WHERE shop_id = 1 AND DATE(created_at) = CURDATE() AND order_status IN ('completed', 'paid', 'delivered', 'shipped')");
  console.log('Today sales:', sales);

  conn.end();
}
run().catch(console.error);
