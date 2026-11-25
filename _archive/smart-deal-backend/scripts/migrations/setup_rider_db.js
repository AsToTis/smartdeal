const mysql = require('mysql2/promise');

async function setupRiderDB() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'smart_deal_db'
  });

  try {
    console.log('Connected to the database. Creating Rider tables...');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS riders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        vehicle_plate VARCHAR(50) NOT NULL,
        license_image TEXT NOT NULL,
        status ENUM('pending', 'approved', 'rejected', 'offline', 'online') DEFAULT 'pending',
        current_lat DECIMAL(10, 8) NULL,
        current_lng DECIMAL(11, 8) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Table "riders" created.');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        rider_id INT NOT NULL,
        status ENUM('finding', 'accepted', 'picking_up', 'delivering', 'delivered') DEFAULT 'finding',
        proof_image TEXT NULL,
        completed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Table "deliveries" created.');

  } catch (err) {
    console.error('Error setting up DB:', err);
  } finally {
    await connection.end();
  }
}

setupRiderDB();
