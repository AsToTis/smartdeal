// ==========================================================
// 007: เติมค่าที่ยังว่างจากหลักฐานจริงในฐานข้อมูล + VIEW ภาษาไทยสำหรับเปิดดูใน phpMyAdmin
// หลักการ: ไม่เดา/ไม่แต่งเวลาที่ไม่เคยถูกบันทึก -> ใน VIEW จะแสดงเหตุผลเป็นภาษาไทยแทนคำว่า NULL
// ==========================================================
module.exports = {
  name: '007_fill_legacy_and_readable_views',
  async up(conn, h) {
    // 1) ไรเดอร์ของออเดอร์เดิม: มีอยู่จริงในตาราง deliveries แต่ orders.rider_id ว่าง
    await conn.query(`
      UPDATE orders o
      JOIN deliveries d ON d.order_id = o.order_id AND d.rider_id IS NOT NULL
      LEFT JOIN riders r ON r.rider_id = d.rider_id
      LEFT JOIN users u ON u.user_id = r.user_id
      SET o.rider_id = COALESCE(o.rider_id, d.rider_id),
          o.rider_name = COALESCE(o.rider_name, r.real_name, r.name, u.full_name)
    `);
    // 2) เวลาที่ลูกค้ายืนยันรับสินค้า: endpoint เดิมเขียน deliveries.completed_at ตอนกดยืนยัน
    await conn.query(`
      UPDATE orders o JOIN deliveries d ON d.order_id = o.order_id
      SET o.completed_at = d.completed_at
      WHERE o.order_status = 'completed' AND o.completed_at IS NULL AND d.status = 'completed' AND d.completed_at IS NOT NULL
    `);
    // 3) ผูกสมุดบัญชีร้านกับเลขออเดอร์ เมื่อจับคู่กับ wallet_transactions ได้ตรงตัว
    await conn.query(`
      UPDATE transactions t
      JOIN wallet_transactions w ON w.user_type = 'shop' AND w.type = 'credit' AND w.target_id = t.shop_id
           AND w.amount = t.amount AND w.created_at = t.created_at AND w.order_id IS NOT NULL
      SET t.order_id = w.order_id
      WHERE t.order_id IS NULL AND t.type = 'order_revenue'
    `);
    // 4) ไรเดอร์ที่ไม่มีชื่อจริง ใช้ชื่อที่แสดงในแอป
    await conn.query('UPDATE riders SET real_name = name WHERE (real_name IS NULL OR real_name = "") AND name IS NOT NULL');
    await conn.query(`UPDATE wallet_transactions w LEFT JOIN shops s ON w.user_type = 'shop' AND s.shop_id = w.target_id
                      LEFT JOIN riders r ON w.user_type = 'rider' AND r.rider_id = w.target_id
                      SET w.target_name = COALESCE(w.target_name, s.name, r.real_name, r.name) WHERE w.target_name IS NULL`);
    // 5) คอลัมน์ที่ไม่มีหน้าจอใช้งาน
    if (await h.columnExists('orders', 'admin_note')) await conn.query('ALTER TABLE orders DROP COLUMN admin_note');

    // 6) VIEW ภาษาไทย
    const [[mig]] = await conn.query("SELECT applied_at FROM schema_migrations WHERE name = '002_data_persistence_upgrade'");
    const cutoff = mig?.applied_at || '2000-01-01 00:00:00';
    const LEGACY = "'ไม่มีบันทึก (ออเดอร์ก่อนเปิดระบบบันทึกเวลา)'";
    const rank = `CASE o.order_status WHEN 'pending' THEN 0 WHEN 'paid' THEN 1 WHEN 'preparing' THEN 2 WHEN 'ready' THEN 3 WHEN 'finding_rider' THEN 3
                  WHEN 'delivering' THEN 5 WHEN 'shipped' THEN 5 WHEN 'delivered' THEN 6 WHEN 'completed' THEN 7 ELSE -1 END`;
    const step = (col, minRank, notReached = "'ยังไม่ถึงขั้นตอนนี้'") => `CASE
        WHEN o.${col} IS NOT NULL THEN DATE_FORMAT(o.${col}, '%d/%m/%Y %H:%i:%s')
        WHEN o.order_status = 'cancelled' THEN 'ออเดอร์ถูกยกเลิกก่อนถึงขั้นตอนนี้'
        WHEN (${rank}) >= ${minRank} AND o.created_at < '${cutoff}' THEN ${LEGACY}
        ELSE ${notReached} END`;

    const views = [
      ['v_orders_readable', `CREATE OR REPLACE VIEW v_orders_readable AS
        SELECT o.order_id AS เลขที่ออเดอร์,
               COALESCE(o.buyer_name, '-') AS ลูกค้า,
               COALESCE(o.shop_name, '-') AS ร้าน,
               COALESCE(o.items_summary, '-') AS รายการสินค้า,
               o.total_amount AS ยอดรวม,
               COALESCE(o.status_th, o.order_status) AS สถานะ,
               DATE_FORMAT(o.created_at, '%d/%m/%Y %H:%i:%s') AS เวลาสั่ง,
               CASE WHEN o.paid_at IS NOT NULL THEN DATE_FORMAT(o.paid_at, '%d/%m/%Y %H:%i:%s')
                    WHEN o.payment_status = 'paid' THEN ${LEGACY}
                    ELSE 'ยังไม่ได้ชำระผ่านระบบ QR' END AS เวลาชำระเงิน,
               ${step('accepted_at', 2)} AS เวลาร้านรับออเดอร์,
               ${step('prepared_at', 3)} AS เวลาร้านเตรียมเสร็จ,
               COALESCE(o.rider_name, CASE WHEN (${rank}) >= 4 THEN 'ไม่มีบันทึก' ELSE 'ยังไม่มีไรเดอร์รับงาน' END) AS ไรเดอร์,
               ${step('rider_assigned_at', 4)} AS เวลาไรเดอร์รับงาน,
               ${step('picked_up_at', 5)} AS เวลารับของจากร้าน,
               ${step('delivered_at', 6)} AS เวลาส่งถึงลูกค้า,
               ${step('completed_at', 7, "'รอลูกค้ากดยืนยันรับสินค้า'")} AS เวลาลูกค้ายืนยันรับ,
               CASE WHEN o.order_status = 'cancelled' THEN CONCAT(COALESCE(DATE_FORMAT(o.cancelled_at, '%d/%m/%Y %H:%i:%s'), '-'), ' โดย ', COALESCE(o.cancelled_by, '-'), ' เหตุผล: ', COALESCE(o.cancel_reason, '-'))
                    ELSE 'ไม่ได้ยกเลิก' END AS การยกเลิก,
               COALESCE(o.coupon_code, 'ไม่ได้ใช้คูปอง') AS คูปอง
        FROM orders o`],
      ['v_notifications_readable', `CREATE OR REPLACE VIEW v_notifications_readable AS
        SELECT n.notification_id AS เลขที่, COALESCE(n.recipient_name, '-') AS ผู้รับ,
               CASE n.recipient_role WHEN 'buyer' THEN 'ลูกค้า' WHEN 'seller' THEN 'ร้านค้า' WHEN 'driver' THEN 'ไรเดอร์' WHEN 'admin' THEN 'แอดมิน' ELSE COALESCE(n.recipient_role, '-') END AS บทบาท,
               n.title AS หัวข้อ, n.message AS ข้อความ,
               DATE_FORMAT(n.created_at, '%d/%m/%Y %H:%i:%s') AS เวลาส่ง,
               CASE WHEN n.is_read = 1 THEN CONCAT('อ่านแล้ว ', COALESCE(DATE_FORMAT(n.read_at, '%d/%m/%Y %H:%i:%s'), '(ไม่มีบันทึกเวลา)')) ELSE 'ยังไม่อ่าน' END AS สถานะการอ่าน,
               CASE WHEN n.delivered_to_device_at IS NOT NULL THEN DATE_FORMAT(n.delivered_to_device_at, '%d/%m/%Y %H:%i:%s') ELSE 'ยังไม่แสดง popup บนเครื่อง' END AS แสดงบนเครื่อง,
               CASE WHEN n.is_deleted = 1 THEN CONCAT('ผู้ใช้ลบออกจากหน้าจอ ', DATE_FORMAT(n.deleted_at, '%d/%m/%Y %H:%i:%s')) ELSE 'แสดงอยู่' END AS การลบ
        FROM notifications n`],
      ['v_withdrawals_readable', `CREATE OR REPLACE VIEW v_withdrawals_readable AS
        SELECT w.id AS เลขที่คำขอ, CASE w.user_type WHEN 'rider' THEN 'ไรเดอร์' ELSE 'ร้านค้า' END AS ประเภท,
               COALESCE(w.requester_name, '-') AS ผู้ขอถอน, w.amount AS จำนวนเงิน, COALESCE(w.bank_info, '-') AS บัญชีรับเงิน,
               CASE w.status WHEN 'pending' THEN 'รออนุมัติ' WHEN 'completed' THEN 'โอนแล้ว' WHEN 'rejected' THEN 'ถูกปฏิเสธ' ELSE w.status END AS สถานะ,
               DATE_FORMAT(w.created_at, '%d/%m/%Y %H:%i:%s') AS เวลาขอถอน,
               CASE WHEN w.status = 'pending' THEN 'ยังไม่ได้ดำเนินการ'
                    ELSE CONCAT(COALESCE(DATE_FORMAT(w.processed_at, '%d/%m/%Y %H:%i:%s'), '-'), ' โดย ', COALESCE(w.processed_by_name, 'ไม่มีบันทึก (ก่อนเปิดระบบบันทึกชื่อแอดมิน)')) END AS การดำเนินการ,
               COALESCE(w.reject_reason, '-') AS เหตุผลที่ปฏิเสธ
        FROM withdrawals w`],
    ];
    for (const [name, sql] of views) {
      try { await conn.query(sql); } catch (e) { console.log(`⚠️ [Migration 007] สร้าง VIEW ${name} ไม่ได้ (${e.message})`); }
    }
  },
};
