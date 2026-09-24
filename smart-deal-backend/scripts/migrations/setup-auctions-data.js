const db = require('../../src/db');

async function seedAuctionData() {
  // 1. ตรวจสอบ/เพิ่มคอลัมน์ original_price และ discount_percent ในตาราง auctions (ถ้ายังไม่มี)
  try {
    await db.query(`ALTER TABLE auctions ADD COLUMN original_price DECIMAL(10,2) DEFAULT NULL`);
  } catch (e) {}
  try {
    await db.query(`ALTER TABLE auctions ADD COLUMN discount_percent INT DEFAULT NULL`);
  } catch (e) {}

  // 2. ตรวจสอบ User 1 (อรวรรณ รักษ์เจริญ)
  try {
    await db.query(`
      INSERT INTO users (user_id, full_name, email, password_hash, phone) 
      VALUES (1, 'อรวรรณ รักษ์เจริญ', 'orawan@smartdeal.com', '123456', '0891234567')
      ON DUPLICATE KEY UPDATE full_name = 'อรวรรณ รักษ์เจริญ'
    `);
    console.log('✅ User 1 (อรวรรณ) verified');
  } catch (e) {
    console.log('User error:', e.message);
  }

  // 3. อัปเดตห้องประมูลที่ 1 (ชุดซูชิรวมพรีเมียม): ขาย ฿89 ลด 80% ราคาเต็ม ฿445
  await db.query(`
    UPDATE auctions 
    SET title = 'ชุดซูชิรวมพรีเมียม (ใกล้หมดอายุ)', 
        description = 'ดื่มด่ำกับรสชาติญี่ปุ่นแท้ๆด้วยชุดซูชิรวมพรีเมียม คัดสรรวัตถุดิบนำเข้าจากญี่ปุ่น ทั้งโอโทโร่ อูนิ และโฮตาเตะ สดใหม่ทุกคำ จัดเตรียมโดยเชฟผู้เชี่ยวชาญ (ควรบริโภคทันทีเพื่อรสชาติที่ดีที่สุด)\n\n• ความสดใหม่: ทำสดใหม่ทุกเช้า\n• การจัดส่ง: ควบคุมอุณหภูมิความเย็นอย่างดี', 
        image_url = 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800', 
        shop_name = 'Sushiro Central World', 
        start_price = 89.00, 
        original_price = 445.00,
        discount_percent = 80,
        current_bid = 120.00, 
        min_increment = 10.00, 
        end_time = DATE_ADD(NOW(), INTERVAL 163 MINUTE), 
        auction_status = 'active',
        winner_user_id = NULL
    WHERE auction_id = 1
  `);

  // อัปเดตห้องประมูลอื่นๆ
  await db.query(`UPDATE auctions SET start_price = 129.00, original_price = 430.00, discount_percent = 70, current_bid = 150.00, end_time = DATE_ADD(NOW(), INTERVAL 5 HOUR), auction_status = 'active' WHERE auction_id = 2`);
  await db.query(`UPDATE auctions SET start_price = 59.00, original_price = 199.00, discount_percent = 70, current_bid = 79.00, end_time = DATE_ADD(NOW(), INTERVAL 8 HOUR), auction_status = 'active' WHERE auction_id = 3`);

  // 4. ปรับปรุงประวัติการเสนอราคาตัวอย่างในตาราง auction_bids สำหรับห้องที่ 1
  await db.query('DELETE FROM auction_bids WHERE auction_id = 1');
  await db.query('INSERT INTO auction_bids (auction_id, user_id, bid_amount, bid_status, created_at) VALUES (1, 1, 120, "active", DATE_SUB(NOW(), INTERVAL 1 MINUTE))');
  await db.query('INSERT INTO auction_bids (auction_id, user_id, bid_amount, bid_status, created_at) VALUES (1, 1, 110, "outbid", DATE_SUB(NOW(), INTERVAL 2 MINUTE))');
  await db.query('INSERT INTO auction_bids (auction_id, user_id, bid_amount, bid_status, created_at) VALUES (1, 2, 100, "outbid", DATE_SUB(NOW(), INTERVAL 3 MINUTE))');
  await db.query('INSERT INTO auction_bids (auction_id, user_id, bid_amount, bid_status, created_at) VALUES (1, 1, 90, "outbid", DATE_SUB(NOW(), INTERVAL 4 MINUTE))');

  console.log('✅ All Auctions and Bids synced with exact 80% discount (Sale: 89, Full: 445)!');
}

seedAuctionData().finally(() => process.exit(0));
