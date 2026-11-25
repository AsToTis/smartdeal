// ==========================================================
// 009: คอลัมน์ข้อความที่ "ยังไม่เกิดเหตุการณ์" ให้แสดงคำอธิบายภาษาไทยแทนค่าว่าง (NULL)
// - ใช้ DEFAULT + เติมแถวเดิม (ไม่ใช้ trigger จึงใช้ได้ทั้ง XAMPP และเซิร์ฟเวอร์ภายนอก)
// - เลือกเฉพาะคอลัมน์ที่แอปไม่ได้ใช้ตัดสินใจแสดงผล (เช่น ไม่แตะ rider_name, shops.reject_reason)
// - คอลัมน์ชนิดวันที่/ตัวเลข ใส่ข้อความไม่ได้ -> ดูคำอธิบายได้ใน VIEW v_*_readable
// ==========================================================
const TEXT_DEFAULTS = [
  // [table, column, type, default text, comment]
  ['orders', 'cancel_reason', 'VARCHAR(500)', 'ไม่ได้ยกเลิก', 'เหตุผลการยกเลิก'],
  ['orders', 'cancelled_by', 'VARCHAR(255)', 'ไม่ได้ยกเลิก', 'ผู้ยกเลิก'],
  ['orders', 'coupon_code', 'VARCHAR(50)', 'ไม่ได้ใช้คูปอง', 'คูปองที่ใช้'],
  ['withdrawals', 'processed_by_name', 'VARCHAR(255)', 'ยังไม่ได้ดำเนินการ', 'แอดมินผู้อนุมัติ/ปฏิเสธ'],
  ['withdrawals', 'reject_reason', 'VARCHAR(500)', 'ไม่ได้ถูกปฏิเสธ', 'เหตุผลที่ปฏิเสธ'],
  ['refund_requests', 'processed_by_name', 'VARCHAR(255)', 'ยังไม่ได้ดำเนินการ', 'แอดมินผู้ดำเนินการ'],
  ['complaints', 'handled_by_name', 'VARCHAR(255)', 'ยังไม่มีแอดมินรับเรื่อง', 'แอดมินผู้ดูแลเรื่อง'],
  ['shops', 'status_updated_by', 'VARCHAR(255)', 'ยังไม่เคยเปลี่ยนสถานะ', 'ผู้เปลี่ยนสถานะร้านล่าสุด'],
  ['riders', 'status_updated_by', 'VARCHAR(255)', 'ยังไม่เคยเปลี่ยนสถานะ', 'ผู้อนุมัติ/ปฏิเสธล่าสุด'],
  ['login_logs', 'fail_reason', 'VARCHAR(255)', 'เข้าสู่ระบบสำเร็จ', 'สาเหตุที่เข้าสู่ระบบไม่สำเร็จ'],
  ['users', 'push_token', 'VARCHAR(255)', 'ยังไม่ได้ลงทะเบียนแจ้งเตือนแบบ push', 'Expo push token'],
  ['users', 'app_settings', 'VARCHAR(1000)', '{"pushEnabled":true,"promoEnabled":true,"locationEnabled":true,"darkMode":false}', 'การตั้งค่าแอปของผู้ใช้ (JSON) ค่าเริ่มต้น = ค่าเริ่มต้นของแอป'],
];

module.exports = {
  name: '009_thai_defaults_for_empty_text',
  async up(conn, h) {
    for (const [t, c, type, def, cm] of TEXT_DEFAULTS) {
      if (!(await h.columnExists(t, c))) continue;
      await conn.query(`UPDATE \`${t}\` SET \`${c}\` = ? WHERE \`${c}\` IS NULL OR \`${c}\` = ''`, [def]);
      await conn.query(`ALTER TABLE \`${t}\` MODIFY \`${c}\` ${type} NULL DEFAULT ${conn.escape(def)} COMMENT ${conn.escape(cm)}`);
    }
    // log การกระทำที่ไม่มีค่าเดิม/ค่าใหม่ (LONGTEXT ตั้ง DEFAULT ไม่ได้ทุกเวอร์ชัน -> เติมแถวเดิม + server เติมให้ตอนบันทึก)
    await conn.query("UPDATE admin_audit_logs SET old_value = 'ไม่มีค่าเดิม (เป็นการสร้างใหม่หรือไม่ได้แก้ค่าใด)' WHERE old_value IS NULL");
    await conn.query("UPDATE admin_audit_logs SET new_value = 'ไม่มีค่าใหม่ (เป็นการลบหรือไม่ได้แก้ค่าใด)' WHERE new_value IS NULL");
    await conn.query("UPDATE users SET app_settings_updated_at = COALESCE(app_settings_updated_at, created_at)");
  },
};
