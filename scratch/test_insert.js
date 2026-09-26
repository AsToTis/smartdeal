const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'smart_deal_db'});
  try {
    await conn.query("INSERT INTO withdrawals (shop_id, amount, status) VALUES (1, 10, 'pending')");
    console.log('Insert success');
  } catch (e) {
    console.log('Error:', e.message);
  }
  conn.end();
}
run().catch(console.error);
