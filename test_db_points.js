const db = require('./smart-deal-backend/src/db');

async function testDBPoints() {
  try {
    console.log('Testing DB connection...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_coupons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        code VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        value DECIMAL(10,2) NOT NULL,
        is_used TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table user_coupons is ready');

    const userId = 2;
    // ensure user_points has record
    await db.execute('INSERT IGNORE INTO user_points (user_id, points) VALUES (?, 1000)', [userId]);
    const [points] = await db.execute('SELECT points FROM user_points WHERE user_id = ?', [userId]);
    console.log('Current points for user 2:', points[0]?.points);

    // Test query coupons
    const [coupons] = await db.execute('SELECT * FROM user_coupons WHERE user_id = ?', [userId]);
    console.log('Coupons count for user 2:', coupons.length);

    console.log('🎉 All MySQL queries succeeded!');
    process.exit(0);
  } catch (err) {
    console.error('❌ DB Error:', err);
    process.exit(1);
  }
}

testDBPoints();
