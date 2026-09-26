const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'smart_deal_db'});
  await conn.query("UPDATE orders SET order_status = 'cancelled' WHERE order_id > 2000");
  console.log('Cancelled mock orders');
  conn.end();
}
run().catch(console.error);
