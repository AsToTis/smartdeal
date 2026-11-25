const mysql = require('mysql2/promise');
async function test() {
  const db = await mysql.createPool({ host: 'localhost', user: 'root', password: '', database: 'smart_deal_db' });
  const [rows] = await db.query('DESCRIBE user_addresses');
  console.log(rows);
  process.exit(0);
}
test();
