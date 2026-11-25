const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

async function fixPoints() {
  const db = await mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'smart_deal_db'
  });

  try {
    // 1. Create table if not exists (just in case)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_point_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        points_change VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Fix users who have 1250 points
    const [users] = await db.execute('SELECT * FROM user_points WHERE points = 1250');
    
    for (const u of users) {
      await db.execute('UPDATE user_points SET points = 1000 WHERE user_id = ?', [u.user_id]);
      
      // check if they have history
      const [hist] = await db.execute('SELECT * FROM user_point_history WHERE user_id = ?', [u.user_id]);
      if (hist.length === 0) {
        await db.execute('INSERT INTO user_point_history (user_id, title, points_change) VALUES (?, ?, ?)', [u.user_id, 'โบนัสต้อนรับสมาชิกใหม่', '+1000']);
      }
    }
    
    console.log('Fixed points for ' + users.length + ' users.');
  } catch (e) {
    console.error(e);
  } finally {
    await db.end();
  }
}

fixPoints();
