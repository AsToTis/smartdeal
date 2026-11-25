const mysql = require('mysql2/promise');
async function run() {
  try {
    const db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'smart_deal_db'
    });
    
    console.log('Altering table shops...');
    await db.query(`
      ALTER TABLE shops
      ADD COLUMN description TEXT NULL,
      ADD COLUMN category_id INT NULL,
      ADD COLUMN bank_name VARCHAR(100) NULL,
      ADD COLUMN bookbank_image TEXT NULL,
      ADD COLUMN reject_reason TEXT NULL;
    `);
    console.log('Success!');
    await db.end();
  } catch(e) {
    console.error('Error:', e.message);
  }
}
run();
