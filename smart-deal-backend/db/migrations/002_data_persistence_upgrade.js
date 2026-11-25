// ==========================================================
// 002: Data persistence upgrade
// - ตาราง log ใหม่: order_status_logs, login_logs, admin_audit_logs
// - ตารางที่เดิมถูกสร้างแบบ lazy: user_coupons, refund_requests
// - คอลัมน์ snapshot / timestamp ภาษาไทย ใน orders, order_items, notifications, ...
// - แก้ ENUM ที่ทำให้ข้อมูลกลายเป็นค่าว่าง และ FK ที่ลบประวัติออเดอร์ทิ้ง
// ทุกขั้นตอนตรวจสอบก่อนแก้ จึงรันซ้ำได้ และใช้ได้ทั้ง MariaDB (XAMPP) และ MySQL 8
// ==========================================================
const { ORDER_STATUS_TH } = require('../labels');

module.exports = {
  name: '002_data_persistence_upgrade',
  async up(conn, h) {
    // ---------- 1. ตารางใหม่ ----------
    await conn.query(`
      CREATE TABLE IF NOT EXISTS order_status_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL COMMENT 'เลขที่คำสั่งซื้อ',
        shop_id INT NULL COMMENT 'ร้านที่เกี่ยวข้อง (ออเดอร์หลายร้าน)',
        shop_name VARCHAR(255) NULL COMMENT 'ชื่อร้าน ณ เวลาที่เกิดเหตุการณ์',
        event_code VARCHAR(50) NOT NULL COMMENT 'รหัสเหตุการณ์ เช่น created, shop_accepted, rider_picked_up',
        from_status VARCHAR(50) NULL,
        to_status VARCHAR(50) NULL,
        status_th VARCHAR(255) NULL COMMENT 'สถานะใหม่ (ภาษาไทย)',
        description_th TEXT NOT NULL COMMENT 'คำอธิบายเหตุการณ์ภาษาไทย',
        actor_type VARCHAR(20) NOT NULL DEFAULT 'system' COMMENT 'buyer / seller / rider / admin / system',
        actor_id INT NULL,
        actor_name VARCHAR(255) NULL COMMENT 'ชื่อผู้ดำเนินการ',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่เกิดเหตุการณ์',
        INDEX idx_osl_order (order_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ไทม์ไลน์ทุกสถานะของคำสั่งซื้อ'
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS login_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        full_name VARCHAR(255) NULL COMMENT 'ชื่อผู้ใช้ ณ เวลาที่เข้าสู่ระบบ',
        role VARCHAR(20) NULL COMMENT 'buyer / seller / driver / admin',
        role_th VARCHAR(50) NULL,
        app_name VARCHAR(50) NOT NULL COMMENT 'แอปที่ใช้เข้าสู่ระบบ',
        login_identifier VARCHAR(255) NULL COMMENT 'อีเมล/เบอร์โทรที่กรอก',
        is_success TINYINT(1) NOT NULL DEFAULT 0,
        fail_reason VARCHAR(255) NULL,
        description_th VARCHAR(500) NOT NULL,
        ip_address VARCHAR(64) NULL,
        user_agent VARCHAR(500) NULL,
        device_info VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_login_user (user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ประวัติการเข้าสู่ระบบทุก Role'
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        actor_type VARCHAR(20) NOT NULL COMMENT 'admin / seller / rider / buyer / system',
        actor_id INT NULL,
        actor_name VARCHAR(255) NULL COMMENT 'ชื่อผู้ดำเนินการ',
        action VARCHAR(80) NOT NULL COMMENT 'รหัสการกระทำ เช่น shop.approve, product.update',
        action_th VARCHAR(255) NOT NULL COMMENT 'การกระทำ (ภาษาไทย)',
        entity_type VARCHAR(50) NULL COMMENT 'ประเภทข้อมูลที่ถูกกระทำ',
        entity_id VARCHAR(64) NULL,
        entity_name VARCHAR(255) NULL COMMENT 'ชื่อข้อมูลที่ถูกกระทำ เช่น ชื่อร้าน/ชื่อเมนู',
        description_th TEXT NOT NULL COMMENT 'รายละเอียดภาษาไทย',
        old_value LONGTEXT NULL COMMENT 'ค่าก่อนแก้ไข (JSON)',
        new_value LONGTEXT NULL COMMENT 'ค่าหลังแก้ไข (JSON)',
        ip_address VARCHAR(64) NULL,
        user_agent VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_entity (entity_type, entity_id),
        INDEX idx_audit_actor (actor_type, actor_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ประวัติการกระทำของแอดมินและร้านค้า'
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_coupons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        code VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        value DECIMAL(10,2) NOT NULL,
        is_used TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await h.addColumn('user_coupons', 'order_id', "INT NULL COMMENT 'ใช้กับคำสั่งซื้อเลขที่'");
    await h.addColumn('user_coupons', 'used_at', "DATETIME NULL COMMENT 'เวลาที่ใช้คูปอง'");

    await conn.query(`
      CREATE TABLE IF NOT EXISTS refund_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        order_id INT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        bank_name VARCHAR(100) NOT NULL,
        account_number VARCHAR(100) NOT NULL,
        account_name VARCHAR(100) NOT NULL,
        slip_image VARCHAR(255) DEFAULT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await h.addColumn('refund_requests', 'requester_name', "VARCHAR(255) NULL COMMENT 'ชื่อผู้ขอคืนเงิน'");
    await h.addColumn('refund_requests', 'processed_by_name', "VARCHAR(255) NULL COMMENT 'แอดมินผู้ดำเนินการ'");
    await h.addColumn('refund_requests', 'processed_at', 'DATETIME NULL');

    // ---------- 2. users / shops / riders ----------
    await conn.query("ALTER TABLE users MODIFY status ENUM('active','suspended','deleted') DEFAULT 'active'");
    await h.addColumn('users', 'push_token', 'VARCHAR(255) NULL');
    await conn.query("ALTER TABLE shops MODIFY status ENUM('pending','approved','rejected','suspended') DEFAULT 'pending'");
    await h.addColumn('shops', 'is_open', 'TINYINT(1) NOT NULL DEFAULT 1');
    await h.addColumn('shops', 'status_updated_at', "DATETIME NULL COMMENT 'เวลาที่เปลี่ยนสถานะร้านล่าสุด'");
    await h.addColumn('shops', 'status_updated_by', "VARCHAR(255) NULL COMMENT 'ผู้เปลี่ยนสถานะร้านล่าสุด'");
    await h.addColumn('riders', 'status_updated_at', "DATETIME NULL COMMENT 'เวลาที่อนุมัติ/ปฏิเสธล่าสุด'");
    await h.addColumn('riders', 'status_updated_by', "VARCHAR(255) NULL COMMENT 'ผู้อนุมัติ/ปฏิเสธล่าสุด'");

    // ---------- 3. orders: snapshot + timestamps ครบทุกสเต็ป ----------
    await h.addColumn('orders', 'shop_statuses', 'LONGTEXT NULL');
    await h.addColumn('orders', 'shop_name', "VARCHAR(500) NULL COMMENT 'ชื่อร้าน ณ ตอนสั่ง'");
    await h.addColumn('orders', 'buyer_name', "VARCHAR(255) NULL COMMENT 'ชื่อลูกค้า ณ ตอนสั่ง'");
    await h.addColumn('orders', 'items_summary', "TEXT NULL COMMENT 'สรุปรายการสินค้า เช่น ข้าวมันไก่ x2 (฿80)'");
    await h.addColumn('orders', 'status_th', "VARCHAR(255) NULL COMMENT 'สถานะปัจจุบัน (ภาษาไทย)'");
    await h.addColumn('orders', 'accepted_at', "DATETIME NULL COMMENT 'เวลาที่ร้านกดรับออเดอร์/เริ่มเตรียม'");
    await h.addColumn('orders', 'rider_name', "VARCHAR(255) NULL COMMENT 'ชื่อไรเดอร์ที่รับงาน'");
    await h.addColumn('orders', 'rider_assigned_at', "DATETIME NULL COMMENT 'เวลาที่ไรเดอร์กดรับงาน'");
    await h.addColumn('orders', 'completed_at', "DATETIME NULL COMMENT 'เวลาที่ลูกค้ายืนยันรับสินค้า'");
    await h.addColumn('orders', 'cancelled_at', "DATETIME NULL COMMENT 'เวลาที่ยกเลิก'");
    await h.addColumn('orders', 'cancel_reason', "VARCHAR(500) NULL COMMENT 'เหตุผลการยกเลิก'");
    await h.addColumn('orders', 'cancelled_by', "VARCHAR(255) NULL COMMENT 'ผู้ยกเลิก'");
    await h.addColumn('orders', 'paid_at', "DATETIME NULL COMMENT 'เวลาที่ชำระเงินสำเร็จ'");
    await h.addColumn('orders', 'coupon_code', "VARCHAR(50) NULL COMMENT 'คูปองที่ใช้'");
    await h.comment('orders', 'prepared_at', "TIMESTAMP NULL DEFAULT NULL COMMENT 'เวลาที่ร้านเตรียมสินค้าเสร็จ (พร้อมส่ง)'");
    await h.comment('orders', 'picked_up_at', "TIMESTAMP NULL DEFAULT NULL COMMENT 'เวลาที่ไรเดอร์รับสินค้าจากร้านครบ'");
    await h.comment('orders', 'delivered_at', "TIMESTAMP NULL DEFAULT NULL COMMENT 'เวลาที่ไรเดอร์ส่งถึงมือลูกค้า'");

    // ---------- 4. order_items: snapshot ราคา ณ ตอนสั่ง ----------
    await conn.query('ALTER TABLE order_items CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    await conn.query('ALTER TABLE order_items MODIFY product_id INT NULL');
    await h.addColumn('order_items', 'shop_name', "VARCHAR(255) NULL COMMENT 'ชื่อร้าน ณ ตอนสั่ง'");
    await h.addColumn('order_items', 'original_price', "DECIMAL(10,2) NULL COMMENT 'ราคาเต็ม ณ ตอนสั่ง'");
    await h.addColumn('order_items', 'discount_percent', "INT NULL COMMENT 'ส่วนลด % ณ ตอนสั่ง'");
    await h.addColumn('order_items', 'line_total', "DECIMAL(10,2) NULL COMMENT 'ราคารวมของรายการนี้ (ราคา x จำนวน)'");

    // ---------- 5. notifications ----------
    await h.addColumn('notifications', 'recipient_name', "VARCHAR(255) NULL COMMENT 'ชื่อผู้รับ'");
    await h.addColumn('notifications', 'recipient_role', "VARCHAR(20) NULL COMMENT 'Role ผู้รับ'");
    await h.addColumn('notifications', 'read_at', "DATETIME NULL COMMENT 'เวลาที่เปิดอ่าน'");

    // ---------- 6. การเงิน ----------
    await conn.query("ALTER TABLE transactions MODIFY type ENUM('withdrawal','income','order_revenue','refund','commission') NOT NULL");
    await h.addColumn('transactions', 'order_id', 'INT NULL');
    await h.addColumn('transactions', 'description', "VARCHAR(500) NULL COMMENT 'คำอธิบายรายการภาษาไทย'");
    await h.addColumn('wallet_transactions', 'target_name', "VARCHAR(255) NULL COMMENT 'ชื่อร้าน/ไรเดอร์เจ้าของกระเป๋า'");
    await conn.query('ALTER TABLE wallet_transactions MODIFY description VARCHAR(500) NULL');
    await conn.query('ALTER TABLE payments MODIFY payment_method VARCHAR(50) NOT NULL');
    await h.addColumn('payments', 'charge_id', 'VARCHAR(100) NULL');
    await h.addColumn('payments', 'payer_name', "VARCHAR(255) NULL COMMENT 'ชื่อผู้ชำระเงิน'");
    await h.addColumn('payments', 'description', "VARCHAR(500) NULL");
    await h.addColumn('withdrawals', 'requester_name', "VARCHAR(255) NULL COMMENT 'ชื่อร้าน/ไรเดอร์ที่ขอถอน'");
    await h.addColumn('withdrawals', 'bank_info', "VARCHAR(255) NULL COMMENT 'บัญชีรับเงิน ณ ตอนขอถอน'");
    await h.addColumn('withdrawals', 'processed_by_name', "VARCHAR(255) NULL COMMENT 'แอดมินผู้อนุมัติ/ปฏิเสธ'");
    await h.addColumn('withdrawals', 'reject_reason', 'VARCHAR(500) NULL');

    // ---------- 7. complaints ----------
    await h.addColumn('complaints', 'updated_at', 'DATETIME NULL');
    await h.addColumn('complaints', 'handled_by_name', "VARCHAR(255) NULL COMMENT 'แอดมินผู้ดูแลเรื่อง'");

    // ---------- 8. FK: ลบสินค้าแล้วประวัติออเดอร์/รีวิวต้องไม่หาย ----------
    await h.setForeignKey('order_items', 'product_id', 'products', 'product_id', 'SET NULL');
    await conn.query('ALTER TABLE reviews MODIFY product_id INT NULL');
    await h.setForeignKey('reviews', 'product_id', 'products', 'product_id', 'SET NULL');

    // ---------- 9. Backfill ข้อมูลเดิมให้อ่านรู้เรื่อง ----------
    await conn.query(`
      UPDATE transactions t LEFT JOIN shops s ON s.shop_id = t.shop_id
      SET t.type = 'order_revenue',
          t.description = COALESCE(t.description, CONCAT('รายรับจากยอดขายของร้าน ', COALESCE(s.name, CONCAT('#', t.shop_id)), ' (หัก GP แล้ว) [ย้อนหลัง]'))
      WHERE t.type = '' OR t.type IS NULL
    `);
    await conn.query(`
      UPDATE order_items oi
      LEFT JOIN shops s ON s.shop_id = oi.shop_id
      LEFT JOIN products p ON p.product_id = oi.product_id
      SET oi.shop_name = COALESCE(oi.shop_name, s.name),
          oi.line_total = COALESCE(oi.line_total, oi.price * oi.quantity),
          oi.original_price = COALESCE(oi.original_price, p.original_price),
          oi.discount_percent = COALESCE(oi.discount_percent, p.discount_percent)
    `);
    await conn.query(`
      UPDATE orders o
      LEFT JOIN users u ON u.user_id = o.user_id
      LEFT JOIN riders r ON r.rider_id = o.rider_id
      LEFT JOIN users ru ON ru.user_id = r.user_id
      SET o.buyer_name = COALESCE(o.buyer_name, u.full_name),
          o.rider_name = COALESCE(o.rider_name, r.name, ru.full_name),
          o.shop_name = COALESCE(o.shop_name, (
            SELECT GROUP_CONCAT(DISTINCT COALESCE(oi.shop_name, s2.name) ORDER BY oi.id SEPARATOR ', ')
            FROM order_items oi LEFT JOIN shops s2 ON s2.shop_id = oi.shop_id WHERE oi.order_id = o.order_id
          ), (SELECT name FROM shops s3 WHERE s3.shop_id = o.shop_id)),
          o.items_summary = COALESCE(o.items_summary, (
            SELECT GROUP_CONCAT(CONCAT(oi.product_name, ' x', oi.quantity, ' (฿', FORMAT(oi.price * oi.quantity, 2), ')') ORDER BY oi.id SEPARATOR ', ')
            FROM order_items oi WHERE oi.order_id = o.order_id
          ))
    `);
    for (const [code, th] of Object.entries(ORDER_STATUS_TH)) {
      await conn.query('UPDATE orders SET status_th = ? WHERE order_status = ? AND (status_th IS NULL OR status_th = "")', [th, code]);
    }
    await conn.query(`
      UPDATE orders o JOIN deliveries d ON d.order_id = o.order_id
      SET o.rider_assigned_at = COALESCE(o.rider_assigned_at, d.assigned_at),
          o.picked_up_at = COALESCE(o.picked_up_at, d.pickup_at),
          o.delivered_at = COALESCE(o.delivered_at, d.completed_at)
    `);
    await conn.query(`
      UPDATE notifications n LEFT JOIN users u ON u.user_id = n.user_id
      SET n.recipient_name = COALESCE(n.recipient_name, u.full_name),
          n.recipient_role = COALESCE(n.recipient_role, u.role)
    `);
    await conn.query(`
      UPDATE wallet_transactions w
      LEFT JOIN shops s ON w.user_type = 'shop' AND s.shop_id = w.target_id
      LEFT JOIN riders r ON w.user_type = 'rider' AND r.rider_id = w.target_id
      SET w.target_name = COALESCE(w.target_name, s.name, r.name)
    `);
    await conn.query(`
      UPDATE withdrawals w
      LEFT JOIN shops s ON s.shop_id = w.shop_id
      LEFT JOIN riders r ON r.rider_id = w.rider_id
      SET w.requester_name = COALESCE(w.requester_name, s.name, r.name),
          w.bank_info = COALESCE(w.bank_info, CASE WHEN s.shop_id IS NOT NULL THEN CONCAT(COALESCE(s.bank_name, '-'), ' ', COALESCE(s.bank_account, '-')) ELSE CONCAT('พร้อมเพย์ ', COALESCE(r.phone, '-')) END)
    `);

    // ไทม์ไลน์ย้อนหลังของออเดอร์เดิม (สร้างเฉพาะออเดอร์ที่ยังไม่มี log)
    const backfill = [
      ['created', 'created_at', 'pending', "CONCAT('ลูกค้า ', COALESCE(o.buyer_name, '-'), ' สั่งซื้อจากร้าน ', COALESCE(o.shop_name, '-'), ' : ', COALESCE(o.items_summary, '-'), ' ยอดรวม ฿', FORMAT(o.total_amount, 2), ' [ย้อนหลัง]')", 'buyer', 'o.user_id', 'o.buyer_name'],
      ['rider_accepted', 'rider_assigned_at', 'rider_accepted', "CONCAT('ไรเดอร์ ', COALESCE(o.rider_name, '-'), ' กดรับงานจัดส่ง [ย้อนหลัง]')", 'rider', 'o.rider_id', 'o.rider_name'],
      ['rider_picked_up', 'picked_up_at', 'delivering', "CONCAT('ไรเดอร์ ', COALESCE(o.rider_name, '-'), ' รับสินค้าจากร้าน ', COALESCE(o.shop_name, '-'), ' แล้ว [ย้อนหลัง]')", 'rider', 'o.rider_id', 'o.rider_name'],
      ['rider_delivered', 'delivered_at', 'delivered', "CONCAT('ไรเดอร์ ', COALESCE(o.rider_name, '-'), ' ส่งสินค้าถึงมือลูกค้า ', COALESCE(o.buyer_name, '-'), ' แล้ว [ย้อนหลัง]')", 'rider', 'o.rider_id', 'o.rider_name'],
    ];
    for (const [code, col, st, desc, actorType, actorId, actorName] of backfill) {
      await conn.query(`
        INSERT INTO order_status_logs (order_id, shop_id, shop_name, event_code, to_status, status_th, description_th, actor_type, actor_id, actor_name, created_at)
        SELECT o.order_id, o.shop_id, o.shop_name, ?, ?, ?, ${desc}, ?, ${actorId}, ${actorName}, o.${col}
        FROM orders o
        WHERE o.${col} IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM order_status_logs l WHERE l.order_id = o.order_id AND l.event_code = ?)
      `, [code, st, ORDER_STATUS_TH[st] || st, actorType, code]);
    }
  },
};
