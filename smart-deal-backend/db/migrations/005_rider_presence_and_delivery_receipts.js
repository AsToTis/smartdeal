// 005: บันทึกการส่งแจ้งเตือนถึงเครื่อง + สถานะออนไลน์ของไรเดอร์
module.exports = {
  name: '005_rider_presence_and_delivery_receipts',
  async up(conn, h) {
    await h.addColumn('notifications', 'delivered_to_device_at', "DATETIME NULL COMMENT 'เวลาที่แจ้งเตือนถูกส่งถึงแอป (แสดง popup แล้ว)'");
    await h.addColumn('riders', 'online_status_updated_at', "DATETIME NULL COMMENT 'เวลาที่ไรเดอร์กดเปิด/ปิดรับงานล่าสุด'");
    await h.addColumn('orders', 'admin_note', "TEXT NULL COMMENT 'บันทึกของแอดมินเกี่ยวกับออเดอร์นี้'");
  },
};
