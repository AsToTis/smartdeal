const mysql = require('mysql2/promise');
async function run() {
  const db = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'smart_deal_db' });
  const [rows] = await db.query('DESCRIBE products');
  console.log(rows);
  db.end();
}
run();
