require('dotenv').config({ path: require('path').join(__dirname, '../smart-deal-backend/.env') });
const db = require('../smart-deal-backend/src/db');

async function migrate() {
  try {
    const [rows] = await db.query("SHOW COLUMNS FROM order_messages LIKE 'shop_id'");
    if (rows.length === 0) {
      await db.query("ALTER TABLE order_messages ADD COLUMN shop_id INT DEFAULT NULL AFTER order_id");
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
