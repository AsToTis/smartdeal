// 011: ตะกร้าสินค้า, ประวัติการค้นหา, ประวัติออกจากระบบ
module.exports = {
  name: '011_cart_search_logout',
  async up(conn, h) {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL COMMENT 'เจ้าของตะกร้า',
        user_name VARCHAR(255) NULL COMMENT 'ชื่อเจ้าของตะกร้า',
        product_id INT NOT NULL,
        product_name VARCHAR(255) NOT NULL COMMENT 'ชื่อเมนู ณ ตอนใส่ตะกร้า',
        shop_id INT NULL,
        shop_name VARCHAR(255) NULL COMMENT 'ชื่อร้าน',
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'ราคาต่อชิ้นขณะอยู่ในตะกร้า',
        line_total DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'ราคารวมของรายการนี้',
        summary_th VARCHAR(500) NULL COMMENT 'สรุปรายการในตะกร้า',
        added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่ใส่ตะกร้าครั้งแรก',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'เวลาที่แก้ไขล่าสุด',
        UNIQUE KEY uq_cart_user_product (user_id, product_id),
        INDEX idx_cart_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตะกร้าสินค้าปัจจุบันของลูกค้า (ประวัติเพิ่ม/ลบอยู่ใน admin_audit_logs)'
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS search_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        user_name VARCHAR(255) NOT NULL DEFAULT 'ผู้ใช้ที่ไม่ได้ล็อกอิน' COMMENT 'ผู้ค้นหา',
        keyword VARCHAR(255) NOT NULL COMMENT 'คำที่ค้นหา',
        shop_results INT NOT NULL DEFAULT 0 COMMENT 'จำนวนร้านที่พบ',
        product_results INT NOT NULL DEFAULT 0 COMMENT 'จำนวนเมนูที่พบ',
        top_results VARCHAR(1000) NOT NULL DEFAULT 'ไม่พบผลลัพธ์' COMMENT 'ตัวอย่างผลลัพธ์ที่พบ',
        description_th VARCHAR(1000) NOT NULL COMMENT 'คำอธิบายภาษาไทย',
        ip_address VARCHAR(64) NOT NULL DEFAULT 'ไม่ทราบ',
        device_info VARCHAR(255) NOT NULL DEFAULT 'ไม่ทราบ',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่ค้นหา',
        INDEX idx_search_user (user_id, created_at),
        INDEX idx_search_kw (keyword)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ประวัติการค้นหาของผู้ใช้'
    `);
    await h.addColumn('login_logs', 'event_type', "VARCHAR(20) NOT NULL DEFAULT 'login' COMMENT 'login = เข้าสู่ระบบ, logout = ออกจากระบบ'");
    await h.addColumn('login_logs', 'event_th', "VARCHAR(50) NOT NULL DEFAULT 'เข้าสู่ระบบ' COMMENT 'ประเภทเหตุการณ์ (ภาษาไทย)'");
    await h.addColumn('login_logs', 'session_minutes', "INT NULL COMMENT 'ระยะเวลาใช้งาน (นาที) นับจากเข้าสู่ระบบครั้งล่าสุด - เฉพาะแถว logout'");
    await h.addColumn('riders', 'last_speed_kmh', "DECIMAL(6,2) NULL COMMENT 'ความเร็วล่าสุดจาก GPS (กม./ชม.)'");
    await h.addColumn('riders', 'location_accuracy_m', "DECIMAL(8,2) NULL COMMENT 'ความแม่นยำพิกัดล่าสุด (เมตร)'");
    for (const t of [['cart_items', 'ตะกร้าสินค้าปัจจุบันของลูกค้า'], ['search_logs', 'ประวัติการค้นหาของผู้ใช้']]) {
      try { await conn.query(`ALTER TABLE ${t[0]} COMMENT = ?`, [t[1]]); } catch (e) { /* ignore */ }
    }
  },
};
