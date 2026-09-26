const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'smart_deal_db'});
  
  await conn.query(`
    INSERT IGNORE INTO reviews (order_id, user_id, shop_id, product_id, rating, comment) 
    VALUES 
    (2048, 1, 1, 41, 5, 'อร่อยมากๆ ครับ อาหารสดใหม่สุดๆ แพ็คมาดีมาก ขอบคุณทางร้านนะครับ'),
    (2047, 1, 1, 40, 4, 'รสชาติดีครับ แต่รออาหารนานไปนิดนึง โดยรวมโอเคครับ')
  `);
  
  console.log('Added reviews');
  conn.end();
}

run().catch(console.error);
