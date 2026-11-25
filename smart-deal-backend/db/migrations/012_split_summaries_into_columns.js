// ==========================================================
// 012: แยกข้อมูลสรุปออกเป็นคอลัมน์ละ 1 หัวข้อ (เลิกใช้ข้อความรวมยาวในช่องเดียว)
//   - ลบ summary_th / timeline_th / order_summary / related_summary
//   - เพิ่มคอลัมน์ตัวเลข/วันที่/ข้อความสั้น แยกตามหัวข้อ เช่น order_count, total_spent, wallet_balance
// ค่าถูกคำนวณโดย src/readable_sync.js
// ==========================================================
const INT = 'INT NULL', MONEY = 'DECIMAL(12,2) NULL', DT = 'DATETIME NULL';
const V = (n = 255) => `VARCHAR(${n}) NULL`;

const ADD = {
  users: [
    ['order_count', INT, 'จำนวนออเดอร์ทั้งหมดที่สั่ง'], ['completed_order_count', INT, 'จำนวนออเดอร์ที่สำเร็จ'], ['cancelled_order_count', INT, 'จำนวนออเดอร์ที่ถูกยกเลิก'],
    ['total_spent', MONEY, 'ยอดซื้อรวม (ไม่นับออเดอร์ที่ยกเลิก)'], ['last_order_at', DT, 'เวลาที่สั่งซื้อล่าสุด'],
    ['points', INT, 'แต้มสะสมคงเหลือ'], ['address_count', INT, 'จำนวนที่อยู่จัดส่ง'],
    ['cart_item_count', INT, 'จำนวนชิ้นในตะกร้าตอนนี้'], ['cart_total', MONEY, 'ยอดรวมในตะกร้าตอนนี้'],
    ['search_count', INT, 'จำนวนครั้งที่ค้นหา'], ['last_search_keyword', V(), 'คำค้นหาล่าสุด'],
    ['owned_shop_name', V(), 'ชื่อร้านที่เป็นเจ้าของ'], ['owned_shop_status_th', V(100), 'สถานะร้านที่เป็นเจ้าของ'],
    ['rider_status_th', V(100), 'สถานะบัญชีไรเดอร์ (ถ้าเป็นไรเดอร์)'],
  ],
  shops: [
    ['menu_count', INT, 'จำนวนเมนู'], ['total_stock', INT, 'สต็อกรวมทุกเมนู'], ['max_discount_percent', INT, 'ส่วนลดสูงสุดของเมนูในร้าน (%)'],
    ['order_count', INT, 'จำนวนออเดอร์ทั้งหมด'], ['completed_order_count', INT, 'ออเดอร์ที่สำเร็จ'], ['cancelled_order_count', INT, 'ออเดอร์ที่ถูกยกเลิก'],
    ['gross_sales', MONEY, 'ยอดขายรวม (ก่อนหัก GP, ไม่นับที่ยกเลิก)'], ['wallet_balance', MONEY, 'เงินคงเหลือในกระเป๋าร้าน'],
    ['review_avg', 'DECIMAL(3,1) NULL', 'คะแนนรีวิวเฉลี่ย'], ['review_count', INT, 'จำนวนรีวิว'], ['bank_info', V(), 'บัญชีรับเงิน'],
  ],
  products: [['sold_order_count', INT, 'จำนวนออเดอร์ที่สั่งเมนูนี้ (ไม่นับที่ยกเลิก)']],
  riders: [
    ['job_count', INT, 'จำนวนงานที่รับ'], ['completed_job_count', INT, 'จำนวนงานที่ส่งสำเร็จ'],
    ['earned_total', MONEY, 'ค่ารอบที่ได้รับ (ลูกค้ายืนยันแล้ว)'], ['withdrawn_total', MONEY, 'ยอดที่ถอนสำเร็จ'], ['pending_withdraw', MONEY, 'ยอดที่รอถอน'],
    ['review_avg', 'DECIMAL(3,1) NULL', 'คะแนนรีวิวเฉลี่ย'], ['review_count', INT, 'จำนวนรีวิว'],
  ],
  orders: [
    ['item_count', INT, 'จำนวนชิ้นทั้งหมดในออเดอร์'], ['shop_count', INT, 'จำนวนร้านในออเดอร์'], ['event_count', INT, 'จำนวนเหตุการณ์ในไทม์ไลน์'],
    ['last_event_th', V(1000), 'เหตุการณ์ล่าสุด'], ['last_event_at', DT, 'เวลาของเหตุการณ์ล่าสุด'], ['last_event_by', V(), 'ผู้ทำเหตุการณ์ล่าสุด'],
  ],
  deliveries: [['pickup_proof_th', V(50), 'มีรูปยืนยันรับของหรือยัง'], ['delivery_proof_th', V(50), 'มีรูปยืนยันส่งของหรือยัง']],
  order_issues: [['order_shop_name', V(500), 'ร้านของออเดอร์'], ['order_items_summary', 'TEXT NULL', 'รายการในออเดอร์'], ['order_total', MONEY, 'ยอดออเดอร์'], ['order_status_th', V(), 'สถานะออเดอร์']],
  complaints: [['order_shop_name', V(500), 'ร้านของออเดอร์'], ['order_items_summary', 'TEXT NULL', 'รายการในออเดอร์'], ['order_total', MONEY, 'ยอดออเดอร์'], ['order_status_th', V(), 'สถานะออเดอร์']],
  refund_requests: [['order_items_summary', 'TEXT NULL', 'รายการในออเดอร์'], ['order_total', MONEY, 'ยอดออเดอร์'], ['order_status_th', V(), 'สถานะออเดอร์']],
  user_coupons: [['order_shop_name', V(500), 'ร้านที่ใช้คูปอง'], ['order_total', MONEY, 'ยอดออเดอร์ที่ใช้คูปอง']],
  notifications: [['related_shop_name', V(500), 'ร้านที่เกี่ยวข้อง'], ['related_item', V(1000), 'สินค้า/รายการที่เกี่ยวข้อง'], ['related_amount', MONEY, 'จำนวนเงินที่เกี่ยวข้อง'], ['related_status_th', V(), 'สถานะของเรื่องที่เกี่ยวข้อง']],
  shop_wallets: [['total_income', MONEY, 'รายรับสุทธิทั้งหมด'], ['income_order_count', INT, 'จำนวนออเดอร์ที่ได้รับเงิน'], ['withdrawn_total', MONEY, 'ถอนสำเร็จ'],
    ['pending_withdraw', MONEY, 'รออนุมัติถอน'], ['rejected_withdraw', MONEY, 'ถอนไม่ผ่าน (คืนยอดแล้ว)'], ['bank_info', V(), 'บัญชีรับเงิน']],
  rider_wallets: [['total_income', MONEY, 'ค่ารอบรวมทั้งหมด'], ['job_count', INT, 'จำนวนงานที่ได้ค่ารอบ'], ['withdrawn_total', MONEY, 'ถอนแล้ว'], ['pending_withdraw', MONEY, 'รออนุมัติถอน'], ['promptpay_phone', V(50), 'พร้อมเพย์รับเงิน']],
  user_points: [['history_count', INT, 'จำนวนรายการประวัติแต้ม'], ['last_change_at', DT, 'เวลาที่แต้มเปลี่ยนล่าสุด'], ['last_change_title', V(), 'รายการแต้มล่าสุด'],
    ['coupons_available', INT, 'คูปองที่ยังใช้ได้'], ['coupons_used', INT, 'คูปองที่ใช้แล้ว']],
};

const DROP = {
  users: ['summary_th'], shops: ['summary_th'], products: ['summary_th'], riders: ['summary_th'], orders: ['summary_th', 'timeline_th'],
  order_items: ['summary_th'], deliveries: ['summary_th'], receipts: ['summary_th'], reviews: ['summary_th'], shop_wallets: ['summary_th'],
  rider_wallets: ['summary_th'], user_points: ['summary_th'], auctions: ['summary_th'], cart_items: ['summary_th'],
  order_issues: ['order_summary'], complaints: ['order_summary'], refund_requests: ['order_summary'], user_coupons: ['order_summary'],
  notifications: ['related_summary'],
};

module.exports = {
  name: '012_split_summaries_into_columns',
  async up(conn, h) {
    for (const [t, cols] of Object.entries(ADD)) for (const [c, type, cm] of cols) await h.addColumn(t, c, `${type} COMMENT ${conn.escape(cm)}`);
    for (const [t, cols] of Object.entries(DROP)) for (const c of cols) await h.dropColumn(t, c);
  },
};
