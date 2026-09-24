const db = require('../src/db');

async function testNotifications() {
  console.log('Testing notification tables and flow...');
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      notification_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'general',
      reference_id INT DEFAULT NULL,
      is_read TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Table notifications created or already exists');

  const [cols] = await db.execute('DESCRIBE notifications');
  console.log('Columns in notifications:', cols.map(c => c.Field));

  // Insert a test notification for user 2 if table is empty
  const [existing] = await db.execute('SELECT COUNT(*) as count FROM notifications WHERE user_id = 2');
  if (existing[0].count === 0) {
    await db.execute(`
      INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at)
      VALUES 
      (2, 'ยินดีด้วย! คุณชนะการประมูล 🎉', 'ยินดีด้วย! คุณชนะการประมูล "ชุดซูชิรวมพรีเมียม (ใกล้หมดอายุ)" ในราคา ฿9,000 กรุณาชำระเงินภายในเวลาที่กำหนด', 'auction_won', 1, 0, NOW()),
      (2, 'คุณถูกแซงราคาประมูล!', 'มีผู้เสนอราคาสูงกว่าคุณในสินค้า "เค้กมาการองชุดพิเศษ 12 ชิ้น" ที่ราคา ฿1,350', 'auction_outbid', 2, 0, DATE_SUB(NOW(), INTERVAL 15 MINUTE)),
      (2, 'การประมูลสิ้นสุดแล้ว', 'การประมูล "สเต็กริบอายพรีเมียม Wagyu A5" สิ้นสุดลงแล้ว คุณไม่ได้รับสิทธิ์ในรอบนี้', 'auction_lost', 3, 1, DATE_SUB(NOW(), INTERVAL 2 HOUR))
    `);
    console.log('✅ Seeded sample notifications for testing');
  }

  const [rows] = await db.execute('SELECT * FROM notifications WHERE user_id = 2 ORDER BY created_at DESC');
  console.log(`Found ${rows.length} notifications for user 2:`, rows.map(r => ({ id: r.notification_id, title: r.title, type: r.type, is_read: r.is_read })));

  process.exit(0);
}

testNotifications().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
