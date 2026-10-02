const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({host:'localhost', user:'root', password:'', database:'smart_deal_db'});
  await conn.query(`UPDATE auctions SET end_time = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE auction_status = 'active'`);
  console.log('Updated active auctions to 30 mins');
  conn.end();
}
run();
