const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({host:'localhost', user:'root', password:'', database:'smart_deal_db'});
  await conn.query(`DELETE FROM notifications WHERE type = 'auction_outbid' OR type = 'shop_auction_bid'`);
  console.log('Cleaned notifications');
  conn.end();
}
run();
