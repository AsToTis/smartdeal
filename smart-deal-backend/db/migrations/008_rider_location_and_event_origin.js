// 008: เวลาอัปเดตตำแหน่งไรเดอร์ + สถานะก่อนหน้าของเหตุการณ์ในไทม์ไลน์
module.exports = {
  name: '008_rider_location_and_event_origin',
  async up(conn, h) {
    await h.addColumn('riders', 'location_updated_at', "DATETIME NULL COMMENT 'เวลาที่ส่งพิกัด GPS ล่าสุด'");
    await h.comment('orders', 'delivery_lat', "DECIMAL(10,8) NULL COMMENT 'พิกัดจุดที่ไรเดอร์กดส่งสำเร็จ (ละติจูด)'");
    await h.comment('orders', 'delivery_lng', "DECIMAL(11,8) NULL COMMENT 'พิกัดจุดที่ไรเดอร์กดส่งสำเร็จ (ลองจิจูด)'");
    // เหตุการณ์ที่ไม่ได้เปลี่ยนสถานะ (เช่น ชำระเงิน รีวิว) ให้ from_status = สถานะในขณะนั้น, เหตุการณ์สร้างออเดอร์ = new
    await conn.query("UPDATE order_status_logs SET from_status = 'new' WHERE from_status IS NULL AND event_code = 'created'");
    await conn.query('UPDATE order_status_logs SET from_status = to_status WHERE from_status IS NULL');
  },
};
