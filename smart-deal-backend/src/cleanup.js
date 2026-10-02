const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../../.env' });
(async () => {
  const db = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'smart_deal_db'
  });
  const [result] = await db.execute(`
    UPDATE auctions a 
    LEFT JOIN products p ON a.title = p.name AND a.shop_id = p.shop_id
    SET a.auction_status = 'cancelled'
    WHERE p.product_id IS NULL AND a.auction_status = 'active'
  `);
  console.log('Cancelled ' + result.affectedRows + ' old test auctions.');
  db.end();
})();
