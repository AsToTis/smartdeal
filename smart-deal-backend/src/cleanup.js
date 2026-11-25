const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME || 'db244',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306
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
