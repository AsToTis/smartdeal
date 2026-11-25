// ==========================================================
// 010: คอลัมน์ "อ่านแล้วเข้าใจได้ทันที" ในทุกตาราง (ไม่ต้องเปิดตารางอื่นประกอบ)
//   - ชื่อแทนรหัส (เช่น shop_name ข้าง shop_id)
//   - สถานะภาษาไทย (*_th)
//   - summary_th : สรุปทั้งแถวเป็นประโยคเดียว / orders.timeline_th : ไทม์ไลน์ทั้งออเดอร์
// ค่าถูกคำนวณโดย src/readable_sync.js (รันหลังทุกการเปลี่ยนแปลงข้อมูล และทุก 1 นาที)
// ==========================================================

const V = (n = 255) => `VARCHAR(${n}) NULL`;
const COLS = {
  users: [['role_th', V(50), 'บทบาท (ภาษาไทย)'], ['status_th', V(50), 'สถานะบัญชี (ภาษาไทย)'], ['summary_th', 'TEXT NULL', 'สรุปข้อมูลผู้ใช้ทั้งหมดในประโยคเดียว']],
  shops: [['owner_name', V(), 'ชื่อเจ้าของร้าน'], ['owner_phone', V(50), 'เบอร์เจ้าของร้าน'], ['owner_email', V(), 'อีเมลเจ้าของร้าน'], ['category_name', V(100), 'ชื่อหมวดหมู่ร้าน'],
    ['status_th', V(100), 'สถานะร้าน (ภาษาไทย)'], ['open_th', V(50), 'เปิด/ปิดรับออเดอร์'], ['summary_th', 'TEXT NULL', 'สรุปร้าน: เจ้าของ เมนู ยอดขาย กระเป๋าเงิน รีวิว']],
  products: [['shop_name', V(), 'ชื่อร้าน'], ['category_name', V(100), 'ชื่อหมวดหมู่'], ['price_th', V(), 'ราคา (ภาษาไทย)'], ['stock_th', V(100), 'สต็อก (ภาษาไทย)'],
    ['sold_qty', 'INT NULL', 'จำนวนที่ขายได้แล้ว (ไม่นับออเดอร์ที่ยกเลิก)'], ['summary_th', 'TEXT NULL', 'สรุปเมนู']],
  riders: [['user_email', V(), 'อีเมลไรเดอร์'], ['status_th', V(100), 'สถานะการอนุมัติ (ภาษาไทย)'], ['online_th', V(100), 'สถานะรับงาน (ภาษาไทย)'], ['summary_th', 'TEXT NULL', 'สรุปไรเดอร์: งาน รายได้ คะแนน ตำแหน่ง']],
  orders: [['payment_status_th', V(100), 'สถานะการชำระเงิน (ภาษาไทย)'], ['payment_method_th', V(100), 'วิธีชำระเงิน (ภาษาไทย)'], ['delivery_type_th', V(100), 'วิธีรับสินค้า (ภาษาไทย)'],
    ['timeline_th', 'TEXT NULL', 'ไทม์ไลน์ทั้งหมดของออเดอร์ (เวลา + เหตุการณ์ + ผู้ทำ)'], ['summary_th', 'TEXT NULL', 'สรุปออเดอร์ในประโยคเดียว']],
  order_items: [['buyer_name', V(), 'ชื่อลูกค้า'], ['order_status_th', V(), 'สถานะออเดอร์ปัจจุบัน'], ['order_created_at', 'DATETIME NULL', 'เวลาที่สั่ง'], ['summary_th', 'TEXT NULL', 'สรุปรายการ']],
  order_status_logs: [['buyer_name', V(), 'ชื่อลูกค้าของออเดอร์'], ['actor_role_th', V(50), 'บทบาทผู้ดำเนินการ (ภาษาไทย)']],
  deliveries: [['rider_name', V(), 'ชื่อไรเดอร์'], ['rider_phone', V(50), 'เบอร์ไรเดอร์'], ['shop_name', V(500), 'ร้านที่ไปรับของ'], ['buyer_name', V(), 'ลูกค้าผู้รับ'],
    ['delivery_address', 'TEXT NULL', 'ที่อยู่จัดส่ง'], ['delivery_fee', 'DECIMAL(10,2) NULL', 'ค่ารอบ'], ['status_th', V(100), 'สถานะงานจัดส่ง (ภาษาไทย)'], ['summary_th', 'TEXT NULL', 'สรุปงานจัดส่ง']],
  payments: [['shop_name', V(500), 'ร้านที่ได้รับเงิน'], ['status_th', V(100), 'สถานะการชำระ (ภาษาไทย)'], ['method_th', V(100), 'วิธีชำระ (ภาษาไทย)']],
  receipts: [['buyer_name', V(), 'ชื่อลูกค้า'], ['shop_name', V(500), 'ชื่อร้าน'], ['total_amount', 'DECIMAL(10,2) NULL', 'ยอดรวม'], ['items_summary', 'TEXT NULL', 'รายการสินค้า'], ['summary_th', 'TEXT NULL', 'สรุปใบเสร็จ']],
  reviews: [['rider_name', V(), 'ชื่อไรเดอร์ที่ถูกรีวิว'], ['items_summary', 'TEXT NULL', 'รายการที่สั่งในออเดอร์ที่รีวิว'], ['summary_th', 'TEXT NULL', 'สรุปรีวิว']],
  order_messages: [['sender_name', V(), 'ชื่อผู้ส่งข้อความ'], ['sender_role_th', V(50), 'บทบาทผู้ส่ง'], ['receiver_th', V(100), 'ส่งถึงใคร'], ['shop_name', V(), 'ร้านที่เกี่ยวข้อง']],
  order_issues: [['reporter_name', V(), 'ผู้แจ้งปัญหา'], ['status_th', V(100), 'สถานะ (ภาษาไทย)'], ['order_summary', 'TEXT NULL', 'สรุปออเดอร์ที่มีปัญหา']],
  complaints: [['reporter_name', V(), 'ผู้ร้องเรียน'], ['reporter_phone', V(50), 'เบอร์ผู้ร้องเรียน'], ['status_th', V(100), 'สถานะ (ภาษาไทย)'], ['order_summary', 'TEXT NULL', 'สรุปออเดอร์ที่เกี่ยวข้อง']],
  refund_requests: [['status_th', V(100), 'สถานะ (ภาษาไทย)'], ['shop_name', V(500), 'ร้านของออเดอร์'], ['order_summary', 'TEXT NULL', 'สรุปออเดอร์ที่ขอคืนเงิน']],
  notifications: [['type_th', V(100), 'ประเภทแจ้งเตือน (ภาษาไทย)'], ['related_summary', 'TEXT NULL', 'ข้อมูลที่เกี่ยวข้องกับแจ้งเตือนนี้']],
  withdrawals: [['status_th', V(100), 'สถานะ (ภาษาไทย)'], ['user_type_th', V(50), 'ประเภทผู้ขอถอน']],
  transactions: [['shop_name', V(), 'ชื่อร้าน'], ['type_th', V(100), 'ประเภทรายการ (ภาษาไทย)'], ['status_th', V(100), 'สถานะ (ภาษาไทย)']],
  wallet_transactions: [['type_th', V(50), 'เงินเข้า/เงินออก'], ['user_type_th', V(50), 'ประเภทกระเป๋า']],
  shop_wallets: [['shop_name', V(), 'ชื่อร้าน'], ['owner_name', V(), 'เจ้าของร้าน'], ['summary_th', 'TEXT NULL', 'สรุปกระเป๋าเงินร้าน']],
  rider_wallets: [['rider_name', V(), 'ชื่อไรเดอร์'], ['summary_th', 'TEXT NULL', 'สรุปกระเป๋าเงินไรเดอร์']],
  user_addresses: [['user_name', V(), 'ชื่อเจ้าของที่อยู่']],
  user_points: [['user_name', V(), 'ชื่อสมาชิก'], ['summary_th', 'TEXT NULL', 'สรุปแต้มสะสม']],
  user_point_history: [['user_name', V(), 'ชื่อสมาชิก']],
  user_coupons: [['user_name', V(), 'ชื่อเจ้าของคูปอง'], ['status_th', V(100), 'สถานะคูปอง'], ['order_summary', 'TEXT NULL', 'ออเดอร์ที่ใช้คูปอง']],
  auctions: [['winner_name', V(), 'ชื่อผู้ชนะประมูล'], ['status_th', V(100), 'สถานะประมูล (ภาษาไทย)'], ['bid_count', 'INT NULL', 'จำนวนครั้งที่มีคนเสนอราคา'], ['summary_th', 'TEXT NULL', 'สรุปการประมูล']],
  auction_bids: [['bidder_name', V(), 'ชื่อผู้เสนอราคา'], ['auction_title', V(), 'สินค้าที่ประมูล'], ['status_th', V(100), 'สถานะการเสนอราคา (ภาษาไทย)']],
  banners: [['status_th', V(50), 'แสดง/ซ่อน']],
  categories: [['product_count', 'INT NULL', 'จำนวนเมนูในหมวดนี้'], ['shop_count', 'INT NULL', 'จำนวนร้านในหมวดนี้']],
};

const TABLE_COMMENTS = {
  users: 'ผู้ใช้ทุกบทบาท (ลูกค้า ร้านค้า ไรเดอร์ แอดมิน)', shops: 'ร้านค้า', products: 'เมนู/สินค้าของร้าน', categories: 'หมวดหมู่',
  riders: 'ไรเดอร์', orders: 'คำสั่งซื้อ', order_items: 'รายการสินค้าในคำสั่งซื้อ (ราคา ณ ตอนสั่ง)', order_status_logs: 'ไทม์ไลน์ทุกเหตุการณ์ของคำสั่งซื้อ',
  deliveries: 'งานจัดส่งของไรเดอร์', payments: 'การชำระเงิน', receipts: 'ใบเสร็จ', reviews: 'รีวิวร้านและไรเดอร์', order_messages: 'แชทในออเดอร์',
  order_issues: 'ปัญหาที่ลูกค้าแจ้งในออเดอร์', complaints: 'เรื่องร้องเรียน/ศูนย์ช่วยเหลือ', refund_requests: 'คำขอคืนเงิน', notifications: 'การแจ้งเตือนทุกชิ้น',
  withdrawals: 'คำขอถอนเงินของร้านและไรเดอร์', transactions: 'สมุดบัญชีร้าน (รายรับ ค่าธรรมเนียม ถอน คืนเงิน)', wallet_transactions: 'เงินเข้า-ออกกระเป๋าร้าน/ไรเดอร์',
  shop_wallets: 'ยอดเงินคงเหลือของร้าน', rider_wallets: 'ยอดเงินคงเหลือของไรเดอร์', user_addresses: 'ที่อยู่จัดส่งของลูกค้า', user_points: 'แต้มสะสม',
  user_point_history: 'ประวัติแต้มสะสม', user_coupons: 'คูปองของผู้ใช้', auctions: 'การประมูล', auction_bids: 'การเสนอราคาประมูล', banners: 'แบนเนอร์โปรโมชัน',
  system_settings: 'ตั้งค่าระบบ', login_logs: 'ประวัติการเข้าสู่ระบบ', admin_audit_logs: 'ประวัติการกระทำของแอดมิน/ร้านค้า/ผู้ใช้', schema_migrations: 'ประวัติการอัปเกรดโครงสร้างฐานข้อมูล',
};

module.exports = {
  name: '010_readable_columns_everywhere',
  async up(conn, h) {
    for (const [table, cols] of Object.entries(COLS)) {
      for (const [col, type, comment] of cols) await h.addColumn(table, col, `${type} COMMENT ${conn.escape(comment)}`);
    }
    for (const [t, c] of Object.entries(TABLE_COMMENTS)) {
      try { await conn.query(`ALTER TABLE \`${t}\` COMMENT = ${conn.escape(c)}`); } catch (e) { /* table may not exist */ }
    }
    // คำนวณครั้งแรกจะทำหลัง migration ทั้งหมดเสร็จ (server เรียก readable sync ตอนเริ่มทำงาน)
  },
};
