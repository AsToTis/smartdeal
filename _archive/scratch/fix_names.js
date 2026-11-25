const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'smart_deal_db'});
  await conn.query(`UPDATE order_items oi JOIN products p ON oi.product_id = p.product_id SET oi.product_name = p.name`);
  console.log('Fixed product names');
  conn.end();
}
run().catch(console.error);
