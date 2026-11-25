// ==========================================================
// 003: Safety-net triggers + user preferences
// - notifications: เติมชื่อ/Role ผู้รับอัตโนมัติ และเวลาอ่าน (read_at)
// - orders: status_th เป็นภาษาไทยตรงกับ order_status เสมอ
// - users.app_settings: เก็บการตั้งค่าแอป (แจ้งเตือน/โปรโมชัน/ตำแหน่ง/ธีม)
// - notifications.is_deleted: ผู้ใช้กดลบแล้วยังเก็บประวัติไว้ (soft delete)
// ถ้าเซิร์ฟเวอร์ไม่ให้สิทธิ์สร้าง TRIGGER จะข้ามไป (โค้ดฝั่ง server บันทึกค่าเหล่านี้เองอยู่แล้ว)
// ==========================================================
const { ORDER_STATUS_TH } = require('../labels');

module.exports = {
  name: '003_readable_triggers_and_prefs',
  async up(conn, h) {
    await h.addColumn('users', 'app_settings', "TEXT NULL COMMENT 'การตั้งค่าแอปของผู้ใช้ (JSON)'");
    await h.addColumn('users', 'app_settings_updated_at', 'DATETIME NULL');
    await h.addColumn('notifications', 'is_deleted', "TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'ผู้ใช้กดลบออกจากหน้าจอแล้ว'");
    await h.addColumn('notifications', 'deleted_at', 'DATETIME NULL');
    await h.addColumn('reviews', 'reviewer_name', "VARCHAR(255) NULL COMMENT 'ชื่อผู้รีวิว ณ เวลาที่รีวิว'");
    await h.addColumn('reviews', 'shop_name', "VARCHAR(255) NULL COMMENT 'ชื่อร้านที่ถูกรีวิว'");
    await conn.query(`UPDATE reviews r LEFT JOIN users u ON u.user_id = r.user_id LEFT JOIN shops s ON s.shop_id = r.shop_id
                      SET r.reviewer_name = COALESCE(r.reviewer_name, u.full_name), r.shop_name = COALESCE(r.shop_name, s.name)`);

    const esc = (s) => String(s).replace(/'/g, "''");
    const caseSql = `CASE NEW.order_status ${Object.entries(ORDER_STATUS_TH).map(([k, v]) => `WHEN '${esc(k)}' THEN '${esc(v)}'`).join(' ')} ELSE NEW.order_status END`;

    const triggers = [
      ['trg_notifications_bi', `CREATE TRIGGER trg_notifications_bi BEFORE INSERT ON notifications FOR EACH ROW
        BEGIN
          IF NEW.recipient_name IS NULL OR NEW.recipient_role IS NULL THEN
            SET NEW.recipient_name = COALESCE(NEW.recipient_name, (SELECT full_name FROM users WHERE user_id = NEW.user_id));
            SET NEW.recipient_role = COALESCE(NEW.recipient_role, (SELECT role FROM users WHERE user_id = NEW.user_id));
          END IF;
        END`],
      ['trg_notifications_bu', `CREATE TRIGGER trg_notifications_bu BEFORE UPDATE ON notifications FOR EACH ROW
        BEGIN
          IF NEW.is_read = 1 AND (OLD.is_read IS NULL OR OLD.is_read = 0) AND NEW.read_at IS NULL THEN
            SET NEW.read_at = NOW();
          END IF;
        END`],
      ['trg_orders_bi', `CREATE TRIGGER trg_orders_bi BEFORE INSERT ON orders FOR EACH ROW
        BEGIN
          SET NEW.status_th = ${caseSql};
        END`],
      ['trg_orders_bu', `CREATE TRIGGER trg_orders_bu BEFORE UPDATE ON orders FOR EACH ROW
        BEGIN
          IF NOT (NEW.order_status <=> OLD.order_status) THEN
            SET NEW.status_th = ${caseSql};
          END IF;
        END`],
    ];
    for (const [name, sql] of triggers) {
      try {
        await conn.query(`DROP TRIGGER IF EXISTS ${name}`);
        await conn.query(sql);
      } catch (e) {
        console.log(`⚠️ [Migration 003] สร้าง trigger ${name} ไม่ได้ (${e.message}) - ใช้การบันทึกจากฝั่ง server แทน`);
      }
    }
    await conn.query('UPDATE notifications SET read_at = created_at WHERE is_read = 1 AND read_at IS NULL');
  },
};
