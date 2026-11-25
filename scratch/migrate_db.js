const db = require('./smart-deal-backend/src/db');

async function migrate() {
  try {
    console.log('Checking order_messages table...');
    // Check if column exists
    const [rows] = await db.query(`SHOW COLUMNS FROM order_messages LIKE 'shop_id'`);
    if (rows.length === 0) {
      console.log('Adding shop_id column to order_messages...');
      await db.query(`ALTER TABLE order_messages ADD COLUMN shop_id INT DEFAULT NULL AFTER order_id`);
      console.log('Column shop_id added successfully!');
    } else {
      console.log('Column shop_id already exists.');
    }
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    process.exit(0);
  }
}

migrate();
