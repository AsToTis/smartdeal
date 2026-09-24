const db = require('../../src/db');

async function setupAuctions() {
  // สร้างตาราง auctions
  await db.query(`
    CREATE TABLE IF NOT EXISTS auctions (
      auction_id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      image_url TEXT,
      shop_id INT DEFAULT 1,
      shop_name VARCHAR(255),
      start_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      current_bid DECIMAL(10,2) DEFAULT 0,
      min_increment DECIMAL(10,2) DEFAULT 50,
      end_time DATETIME NOT NULL,
      auction_status ENUM('active','ended','cancelled') DEFAULT 'active',
      winner_user_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // สร้างตาราง auction_bids
  await db.query(`
    CREATE TABLE IF NOT EXISTS auction_bids (
      bid_id INT AUTO_INCREMENT PRIMARY KEY,
      auction_id INT NOT NULL,
      user_id INT NOT NULL,
      bid_amount DECIMAL(10,2) NOT NULL,
      bid_status ENUM('active','outbid','won') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // เพิ่มข้อมูลตัวอย่าง
  const endTime1 = new Date(Date.now() + 1.5 * 3600 * 1000).toISOString().slice(0,19).replace('T', ' ');
  const endTime2 = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0,19).replace('T', ' ');
  const endTime3 = new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0,19).replace('T', ' ');

  const [existing] = await db.query('SELECT COUNT(*) as cnt FROM auctions');
  if (existing[0].cnt === 0) {
    await db.query(
      'INSERT INTO auctions (title, description, image_url, shop_id, shop_name, start_price, current_bid, min_increment, end_time) VALUES (?,?,?,?,?,?,?,?,?)',
      ['ชุดซูชิรวมพรีเมียม (ใกล้หมดอายุ)', 'ดื่มด่ำกับรสชาติดั้งเดิมของชุดซูชิรวมพรีเมียม คัดสรรวัตถุดิบนำเข้าจากญี่ปุ่น ทั้งโอโทโร อูนิ และโฮตาเตะ สดใหม่ทุกคำ จัดเตรียมโดยเชฟผู้เชี่ยวชาญ', 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800', 1, 'Sushiro Central World', 5000, 8900, 100, endTime1]
    );
    await db.query(
      'INSERT INTO auctions (title, description, image_url, shop_id, shop_name, start_price, current_bid, min_increment, end_time) VALUES (?,?,?,?,?,?,?,?,?)',
      ['เค้กมาการองชุดพิเศษ 12 ชิ้น', 'มาการองจากฝรั่งเศส รสชาติหลากหลาย ทำสดใหม่ทุกวัน เหลือจากออเดอร์ VIP วันนี้เท่านั้น', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800', 2, 'Paul French Bakery', 800, 1200, 50, endTime2]
    );
    await db.query(
      'INSERT INTO auctions (title, description, image_url, shop_id, shop_name, start_price, current_bid, min_increment, end_time) VALUES (?,?,?,?,?,?,?,?,?)',
      ['สเต็กริบอายพรีเมียม Wagyu A5', 'วากิวเกรด A5 จากญี่ปุ่น หนัก 350g พร้อมซอส 3 ชนิด หมดอายุวันนี้เท่านั้น', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800', 3, 'The Garden Bistro', 3500, 5800, 200, endTime3]
    );
    console.log('Seed data inserted!');
  } else {
    console.log('Auction data already exists, skipping seed.');
  }

  console.log('Auction tables ready!');
}

setupAuctions().finally(() => process.exit());
