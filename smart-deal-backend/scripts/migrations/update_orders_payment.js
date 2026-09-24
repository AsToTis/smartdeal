const db = require('../../src/db');

async function updateOrdersTable() {
  try {
    console.log('Adding payment_status and charge_id to orders table...');
    
    // Check if columns exist
    const [columns] = await db.query("SHOW COLUMNS FROM orders");
    const columnNames = columns.map(c => c.Field);

    if (!columnNames.includes('payment_status')) {
      await db.query(`ALTER TABLE orders ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending'`);
      console.log('Added payment_status column.');
    } else {
      console.log('payment_status column already exists.');
    }

    if (!columnNames.includes('charge_id')) {
      await db.query(`ALTER TABLE orders ADD COLUMN charge_id VARCHAR(100) DEFAULT NULL`);
      console.log('Added charge_id column.');
    } else {
      console.log('charge_id column already exists.');
    }

    console.log('Orders table update complete!');
  } catch (error) {
    console.error('Error updating orders table:', error);
  } finally {
    process.exit();
  }
}

updateOrdersTable();
