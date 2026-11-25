// ==========================================================
// Smart Deal - Readable columns sync
// เติม/อัปเดตคอลัมน์ "อ่านเข้าใจได้ทันที" ในทุกตาราง โดยแยก 1 หัวข้อต่อ 1 คอลัมน์
//   - ชื่อแทนรหัส (shop_name, rider_name, ...)
//   - สถานะภาษาไทย (*_th)
//   - ตัวเลขสรุป (order_count, total_spent, wallet_balance, ...)
// ใช้ SQL มาตรฐาน (UPDATE ... JOIN) จึงรันได้ทั้ง MariaDB (XAMPP) และ MySQL 8 โดยไม่ต้องใช้ trigger
//   - ข้อมูลหลัก (ผู้ใช้ ร้าน เมนู กระเป๋าเงิน): คำนวณใหม่ทุกครั้งให้เป็นปัจจุบัน
//   - ข้อมูลประวัติ (ชื่อใน order_items, แชท, รีวิว ฯลฯ): เติมครั้งเดียวตอนยังว่าง = snapshot ณ เวลาเกิดเหตุการณ์
// ==========================================================
// ระยะทาง (กม.) จากจุดอ้างอิงของระบบ = พิกัดเริ่มต้นในฐานข้อมูล (ม.มหาสารคาม 16.246826, 103.251992)
const HAV = (lat, lng) => `6371 * 2 * ASIN(SQRT(POW(SIN(RADIANS(${lat} - 16.246826) / 2), 2) + COS(RADIANS(16.246826)) * COS(RADIANS(${lat})) * POW(SIN(RADIANS(${lng} - 103.251992) / 2), 2)))`;
const CASE = (expr, map, fallback) => `CASE ${expr} ${Object.entries(map).map(([k, v]) => `WHEN '${k}' THEN '${v}'`).join(' ')} ELSE ${fallback || expr} END`;

const ROLE = { buyer: 'ลูกค้า', seller: 'ร้านค้า', driver: 'ไรเดอร์', rider: 'ไรเดอร์', admin: 'ผู้ดูแลระบบ', system: 'ระบบอัตโนมัติ' };
const USER_ST = { active: 'ใช้งานได้ปกติ', suspended: 'ถูกระงับการใช้งาน', deleted: 'ลบบัญชีแล้ว' };
const SHOP_ST = { pending: 'รอแอดมินตรวจสอบ', approved: 'อนุมัติแล้ว เปิดขายได้', rejected: 'ถูกปฏิเสธ', suspended: 'ถูกระงับโดยแอดมิน' };
const RIDER_ST = { pending: 'รอแอดมินอนุมัติ', approved: 'อนุมัติแล้ว รับงานได้', rejected: 'ถูกปฏิเสธ' };

const STATEMENTS = [
  // ---------------- users ----------------
  `UPDATE users u
   LEFT JOIN (SELECT user_id, COUNT(*) n, SUM(order_status = 'completed') done, SUM(order_status = 'cancelled') cancel,
                     SUM(CASE WHEN order_status <> 'cancelled' THEN total_amount ELSE 0 END) spent, MAX(created_at) last_order
              FROM orders GROUP BY user_id) o ON o.user_id = u.user_id
   LEFT JOIN (SELECT owner_id, MIN(shop_id) shop_id FROM shops GROUP BY owner_id) so ON so.owner_id = u.user_id
   LEFT JOIN shops s ON s.shop_id = so.shop_id
   LEFT JOIN riders r ON r.user_id = u.user_id
   LEFT JOIN user_points p ON p.user_id = u.user_id
   LEFT JOIN (SELECT user_id, COUNT(*) n FROM user_addresses GROUP BY user_id) a ON a.user_id = u.user_id
   LEFT JOIN (SELECT user_id, SUM(quantity) q, SUM(line_total) amt FROM cart_items GROUP BY user_id) ct ON ct.user_id = u.user_id
   LEFT JOIN (SELECT user_id, COUNT(*) n, MAX(id) last_id FROM search_logs WHERE user_id IS NOT NULL GROUP BY user_id) sl ON sl.user_id = u.user_id
   LEFT JOIN search_logs sk ON sk.id = sl.last_id
   SET u.role_th = ${CASE('u.role', ROLE)},
       u.status_th = ${CASE('u.status', USER_ST)},
       u.order_count = COALESCE(o.n, 0), u.completed_order_count = COALESCE(o.done, 0), u.cancelled_order_count = COALESCE(o.cancel, 0),
       u.total_spent = COALESCE(o.spent, 0), u.last_order_at = o.last_order,
       u.points = p.points, u.address_count = COALESCE(a.n, 0),
       u.cart_item_count = COALESCE(ct.q, 0), u.cart_total = COALESCE(ct.amt, 0),
       u.search_count = COALESCE(sl.n, 0), u.last_search_keyword = sk.keyword,
       u.owned_shop_name = s.name, u.owned_shop_status_th = IF(s.shop_id IS NULL, NULL, ${CASE('s.status', SHOP_ST)}),
       u.rider_status_th = IF(r.rider_id IS NULL, NULL, ${CASE('r.status', RIDER_ST)})`,

  // ---------------- categories ----------------
  `UPDATE categories c
   LEFT JOIN (SELECT category_id, COUNT(*) n FROM products GROUP BY category_id) p ON p.category_id = c.category_id
   LEFT JOIN (SELECT category_id, COUNT(*) n FROM shops GROUP BY category_id) s ON s.category_id = c.category_id
   SET c.product_count = COALESCE(p.n, 0), c.shop_count = COALESCE(s.n, 0)`,

  // ---------------- products ----------------
  `UPDATE products p
   LEFT JOIN shops s ON s.shop_id = p.shop_id
   LEFT JOIN categories c ON c.category_id = p.category_id
   LEFT JOIN (SELECT oi.product_id, SUM(oi.quantity) q, COUNT(DISTINCT oi.order_id) n FROM order_items oi JOIN orders o ON o.order_id = oi.order_id
              WHERE o.order_status <> 'cancelled' GROUP BY oi.product_id) sold ON sold.product_id = p.product_id
   SET p.shop_name = s.name, p.category_name = c.name,
       p.price_th = CONCAT('ราคาเต็ม ฿', FORMAT(COALESCE(p.original_price, 0), 2), ' ลด ', COALESCE(p.discount_percent, 0), '% เหลือ ฿', FORMAT(COALESCE(p.discount_price, 0), 2)),
       p.stock_th = IF(p.stock_quantity > 0, CONCAT('เหลือ ', p.stock_quantity, ' ชิ้น'), 'สินค้าหมด'),
       p.sold_qty = COALESCE(sold.q, 0), p.sold_order_count = COALESCE(sold.n, 0)`,

  // ---------------- shops ----------------
  `UPDATE shops s
   LEFT JOIN users u ON u.user_id = s.owner_id
   LEFT JOIN categories c ON c.category_id = s.category_id
   LEFT JOIN (SELECT shop_id, COUNT(*) n, SUM(stock_quantity) stock, MAX(discount_percent) maxd FROM products GROUP BY shop_id) p ON p.shop_id = s.shop_id
   LEFT JOIN (SELECT oi.shop_id, COUNT(DISTINCT oi.order_id) n, COUNT(DISTINCT IF(o.order_status = 'completed', o.order_id, NULL)) done,
                     COUNT(DISTINCT IF(o.order_status = 'cancelled', o.order_id, NULL)) cancel,
                     SUM(IF(o.order_status <> 'cancelled', oi.price * oi.quantity, 0)) gross
              FROM order_items oi JOIN orders o ON o.order_id = oi.order_id GROUP BY oi.shop_id) o ON o.shop_id = s.shop_id
   LEFT JOIN (SELECT shop_id, ROUND(AVG(rating), 1) avg_r, COUNT(*) n FROM reviews GROUP BY shop_id) rv ON rv.shop_id = s.shop_id
   LEFT JOIN shop_wallets w ON w.shop_id = s.shop_id
   SET s.owner_name = u.full_name, s.owner_phone = u.phone, s.owner_email = u.email, s.category_name = c.name,
       s.status_th = ${CASE('s.status', SHOP_ST)},
       s.open_th = IF(s.is_open = 1, 'เปิดรับออเดอร์', 'ปิดร้านชั่วคราว'),
       s.tag1 = COALESCE(c.name, s.tag1),
       s.tag2 = IF(COALESCE(p.maxd, 0) > 0, CONCAT('ลดสูงสุด ', p.maxd, '%'), 'ยังไม่มีดีลลดราคา'),
       s.distance = IF(s.latitude IS NULL, s.distance, CONCAT(ROUND(${HAV('s.latitude', 's.longitude')}, 1), ' กม.')),
       s.menu_count = COALESCE(p.n, 0), s.total_stock = COALESCE(p.stock, 0), s.max_discount_percent = COALESCE(p.maxd, 0),
       s.order_count = COALESCE(o.n, 0), s.completed_order_count = COALESCE(o.done, 0), s.cancelled_order_count = COALESCE(o.cancel, 0),
       s.gross_sales = COALESCE(o.gross, 0), s.wallet_balance = COALESCE(w.balance, 0),
       s.review_avg = rv.avg_r, s.review_count = COALESCE(rv.n, 0),
       s.bank_info = CONCAT(COALESCE(s.bank_name, '-'), ' ', COALESCE(s.bank_account, '-'))`,

  // ---------------- riders ----------------
  `UPDATE riders r
   LEFT JOIN users u ON u.user_id = r.user_id
   LEFT JOIN (SELECT d.rider_id, COUNT(*) n, SUM(d.status IN ('delivered','completed')) done, SUM(IF(d.status = 'completed', o.delivery_fee, 0)) earned
              FROM deliveries d JOIN orders o ON o.order_id = d.order_id GROUP BY d.rider_id) d ON d.rider_id = r.rider_id
   LEFT JOIN (SELECT rider_id, ROUND(AVG(rider_rating), 1) avg_r, COUNT(rider_rating) n FROM reviews WHERE rider_rating IS NOT NULL GROUP BY rider_id) rv ON rv.rider_id = r.rider_id
   LEFT JOIN (SELECT rider_id, SUM(IF(status = 'completed', amount, 0)) paid, SUM(IF(status = 'pending', amount, 0)) pend FROM withdrawals WHERE rider_id IS NOT NULL GROUP BY rider_id) w ON w.rider_id = r.rider_id
   SET r.user_email = u.email,
       r.vehicle_detail = CONCAT(COALESCE(r.vehicle_type, '-'), ' ทะเบียน ', COALESCE(NULLIF(r.vehicle_plate, ''), '-')),
       r.status_th = ${CASE('r.status', RIDER_ST)},
       r.online_th = ${CASE('r.rider_status', { available: 'เปิดรับงาน (Online)', busy: 'กำลังวิ่งงาน', offline: 'ปิดรับงาน (Offline)' })},
       r.job_count = COALESCE(d.n, 0), r.completed_job_count = COALESCE(d.done, 0), r.earned_total = COALESCE(d.earned, 0),
       r.withdrawn_total = COALESCE(w.paid, 0), r.pending_withdraw = COALESCE(w.pend, 0),
       r.review_avg = rv.avg_r, r.review_count = COALESCE(rv.n, 0)`,

  // ---------------- orders ----------------
  `UPDATE orders o
   LEFT JOIN (SELECT order_id, SUM(quantity) q, COUNT(DISTINCT shop_id) shops FROM order_items GROUP BY order_id) i ON i.order_id = o.order_id
   LEFT JOIN (SELECT order_id, COUNT(*) n, MAX(id) last_id FROM order_status_logs GROUP BY order_id) lc ON lc.order_id = o.order_id
   LEFT JOIN order_status_logs le ON le.id = lc.last_id
   SET o.payment_status_th = ${CASE('o.payment_status', { pending: 'ยังไม่ชำระเงิน', paid: 'ชำระเงินแล้ว', failed: 'ชำระเงินไม่สำเร็จ', refunded: 'คืนเงินแล้ว' })},
       o.payment_method_th = ${CASE('o.payment_method', { promptpay: 'พร้อมเพย์ (สแกน QR)', cash: 'เงินสด', mobilebanking: 'โมบายแบงก์กิ้ง' })},
       o.delivery_type_th = ${CASE('o.delivery_type', { delivery: 'จัดส่งถึงที่อยู่', pickup: 'ลูกค้ารับเองที่ร้าน' })},
       o.item_count = COALESCE(i.q, 0), o.shop_count = COALESCE(i.shops, 0), o.event_count = COALESCE(lc.n, 0),
       o.last_event_th = le.description_th, o.last_event_at = le.created_at, o.last_event_by = le.actor_name`,

  // ---------------- order_items ----------------
  `UPDATE order_items oi JOIN orders o ON o.order_id = oi.order_id
   SET oi.buyer_name = COALESCE(oi.buyer_name, o.buyer_name),
       oi.order_created_at = COALESCE(oi.order_created_at, o.created_at),
       oi.order_status_th = COALESCE(o.status_th, o.order_status)`,

  // ---------------- order_status_logs ----------------
  `UPDATE order_status_logs l JOIN orders o ON o.order_id = l.order_id
   SET l.buyer_name = COALESCE(l.buyer_name, o.buyer_name), l.actor_role_th = ${CASE('l.actor_type', ROLE)}`,

  // ---------------- deliveries ----------------
  `UPDATE deliveries d JOIN orders o ON o.order_id = d.order_id
   LEFT JOIN riders r ON r.rider_id = d.rider_id
   SET d.rider_name = COALESCE(d.rider_name, r.real_name, r.name), d.rider_phone = COALESCE(d.rider_phone, r.phone),
       d.shop_name = COALESCE(d.shop_name, o.shop_name), d.buyer_name = COALESCE(d.buyer_name, o.buyer_name),
       d.delivery_address = COALESCE(d.delivery_address, o.shipping_address), d.delivery_fee = COALESCE(d.delivery_fee, o.delivery_fee),
       d.status_th = ${CASE('d.status', { assigned: 'มอบหมายงานแล้ว', accepted: 'ไรเดอร์รับงานแล้ว', arriving_shop: 'ไรเดอร์ถึงร้านแล้ว', picked_up: 'รับของจากร้านแล้ว', delivering: 'กำลังนำส่ง', delivered: 'ส่งถึงลูกค้าแล้ว รอยืนยัน', completed: 'ลูกค้ายืนยันรับแล้ว', cancelled: 'ยกเลิก' })},
       d.pickup_proof_th = IF(d.pickup_proof_image IS NULL OR d.pickup_proof_image = '', 'ยังไม่มีรูปยืนยันรับของ', 'มีรูปยืนยันรับของแล้ว'),
       d.delivery_proof_th = IF(d.proof_image IS NULL OR d.proof_image = '', 'ยังไม่มีรูปยืนยันส่งของ', 'มีรูปยืนยันส่งของแล้ว')`,

  // ---------------- payments / receipts ----------------
  `UPDATE payments p JOIN orders o ON o.order_id = p.order_id
   SET p.shop_name = COALESCE(p.shop_name, o.shop_name), p.payer_name = COALESCE(p.payer_name, o.buyer_name),
       p.status_th = ${CASE('p.payment_status', { pending: 'รอชำระ', success: 'ชำระสำเร็จ', failed: 'ชำระไม่สำเร็จ' })},
       p.method_th = ${CASE('p.payment_method', { promptpay: 'พร้อมเพย์ (สแกน QR)', cash: 'เงินสด', mobilebanking: 'โมบายแบงก์กิ้ง' })}`,
  `UPDATE receipts rc JOIN orders o ON o.order_id = rc.order_id
   SET rc.buyer_name = COALESCE(rc.buyer_name, o.buyer_name), rc.shop_name = COALESCE(rc.shop_name, o.shop_name),
       rc.total_amount = COALESCE(rc.total_amount, o.total_amount), rc.items_summary = COALESCE(rc.items_summary, o.items_summary)`,

  // ---------------- reviews ----------------
  `UPDATE reviews rv LEFT JOIN orders o ON o.order_id = rv.order_id LEFT JOIN riders r ON r.rider_id = rv.rider_id
   LEFT JOIN users u ON u.user_id = rv.user_id LEFT JOIN shops s ON s.shop_id = rv.shop_id
   SET rv.reviewer_name = COALESCE(rv.reviewer_name, u.full_name), rv.shop_name = COALESCE(rv.shop_name, s.name),
       rv.rider_name = COALESCE(rv.rider_name, r.real_name, r.name), rv.items_summary = COALESCE(rv.items_summary, o.items_summary)`,

  // ---------------- order_messages ----------------
  `UPDATE order_messages m JOIN orders o ON o.order_id = m.order_id
   LEFT JOIN riders r ON m.sender_type = 'rider' AND r.rider_id = m.sender_id
   LEFT JOIN users u ON m.sender_type <> 'rider' AND u.user_id = m.sender_id
   LEFT JOIN shops s ON s.shop_id = m.shop_id
   SET m.sender_name = COALESCE(m.sender_name, r.real_name, r.name, u.full_name, IF(m.sender_type = 'buyer', o.buyer_name, NULL), IF(m.sender_type = 'rider', o.rider_name, NULL), IF(m.sender_type = 'seller', o.shop_name, NULL)),
       m.sender_role_th = ${CASE('m.sender_type', { buyer: 'ลูกค้า', seller: 'ร้านค้า', rider: 'ไรเดอร์', system: 'ระบบ' })},
       m.receiver_th = ${CASE('m.receiver_type', { buyer: 'ถึงลูกค้า', seller: 'ถึงร้านค้า', rider: 'ถึงไรเดอร์', all: 'ถึงทุกคนในออเดอร์' }, "'ถึงทุกคนในออเดอร์'")},
       m.shop_name = COALESCE(m.shop_name, s.name, o.shop_name)`,

  // ---------------- order_issues / complaints / refunds ----------------
  `UPDATE order_issues i LEFT JOIN users u ON u.user_id = i.user_id LEFT JOIN orders o ON o.order_id = i.order_id
   SET i.reporter_name = COALESCE(i.reporter_name, u.full_name),
       i.status_th = ${CASE('i.status', { pending: 'รอดำเนินการ', investigating: 'แอดมินกำลังตรวจสอบ', resolved: 'แก้ไขเรียบร้อยแล้ว' })},
       i.order_shop_name = o.shop_name, i.order_items_summary = o.items_summary, i.order_total = o.total_amount, i.order_status_th = o.status_th`,
  `UPDATE complaints c LEFT JOIN users u ON u.user_id = c.user_id LEFT JOIN orders o ON o.order_id = c.order_id
   SET c.reporter_name = COALESCE(c.reporter_name, u.full_name), c.reporter_phone = COALESCE(c.reporter_phone, u.phone),
       c.status_th = ${CASE('c.status', { pending: 'รอดำเนินการ', in_progress: 'แอดมินกำลังดำเนินการ', resolved: 'แก้ไขเรียบร้อยแล้ว' })},
       c.order_shop_name = IF(c.order_id IS NULL, 'เรื่องทั่วไป ไม่เกี่ยวกับออเดอร์', o.shop_name),
       c.order_items_summary = IF(c.order_id IS NULL, 'เรื่องทั่วไป ไม่เกี่ยวกับออเดอร์', o.items_summary),
       c.order_total = o.total_amount,
       c.order_status_th = IF(c.order_id IS NULL, 'เรื่องทั่วไป ไม่เกี่ยวกับออเดอร์', o.status_th)`,
  `UPDATE refund_requests rf LEFT JOIN orders o ON o.order_id = rf.order_id LEFT JOIN users u ON u.user_id = rf.user_id
   SET rf.requester_name = COALESCE(rf.requester_name, u.full_name), rf.shop_name = COALESCE(rf.shop_name, o.shop_name),
       rf.status_th = ${CASE('rf.status', { pending: 'รอแอดมินตรวจสอบ', approved: 'อนุมัติคืนเงินแล้ว', rejected: 'ปฏิเสธการคืนเงิน' })},
       rf.order_items_summary = o.items_summary, rf.order_total = o.total_amount, rf.order_status_th = o.status_th`,

  // ---------------- notifications ----------------
  `UPDATE notifications n
   LEFT JOIN orders o ON n.type IN ('order','order_status','refund','refund_request','auction_won') AND o.order_id = n.reference_id
   LEFT JOIN auctions a ON n.type IN ('auction_lost','auction_outbid') AND a.auction_id = n.reference_id
   LEFT JOIN shops s ON n.type LIKE 'shop_%' AND s.shop_id = n.reference_id
   LEFT JOIN withdrawals w ON n.type = 'withdrawal' AND w.id = n.reference_id
   SET n.type_th = ${CASE('n.type', { order: 'อัปเดตคำสั่งซื้อ', order_status: 'อัปเดตคำสั่งซื้อ', auction_won: 'ชนะการประมูล', auction_lost: 'แพ้การประมูล', auction_outbid: 'มีคนเสนอราคาสูงกว่า',
     shop_approved: 'ร้านได้รับอนุมัติ', shop_rejected: 'ร้านถูกปฏิเสธ', shop_suspended: 'ร้านถูกระงับ', rider_approved: 'ไรเดอร์ได้รับอนุมัติ', rider_rejected: 'ไรเดอร์ถูกปฏิเสธ',
     withdrawal: 'การถอนเงิน', refund: 'การคืนเงิน', refund_request: 'ขอคืนเงินได้', complaint: 'เรื่องร้องเรียน', account_status: 'สถานะบัญชี', general: 'ทั่วไป', message: 'ข้อความใหม่', review: 'รีวิวใหม่' })},
       n.related_shop_name = COALESCE(o.shop_name, a.shop_name, s.name, IF(w.id IS NULL, NULL, w.requester_name)),
       n.related_item = COALESCE(o.items_summary, a.title, IF(w.id IS NULL, NULL, CONCAT('คำขอถอนเงิน #', w.id))),
       n.related_amount = COALESCE(o.total_amount, a.current_bid, w.amount),
       n.related_status_th = COALESCE(o.status_th, ${CASE('a.auction_status', { active: 'กำลังประมูล', ended: 'ปิดประมูลแล้ว', cancelled: 'ยกเลิก' }, 'NULL')}, s.status_th, w.status_th)`,

  // ---------------- การเงิน ----------------
  `UPDATE withdrawals w
   SET w.status_th = ${CASE('w.status', { pending: 'รอแอดมินอนุมัติ', completed: 'โอนเงินแล้ว', rejected: 'ถูกปฏิเสธ (คืนยอดเข้ากระเป๋า)' })},
       w.user_type_th = ${CASE('w.user_type', { shop: 'ร้านค้า', rider: 'ไรเดอร์' })}`,
  `UPDATE transactions t LEFT JOIN shops s ON s.shop_id = t.shop_id
   SET t.shop_name = COALESCE(t.shop_name, s.name),
       t.type_th = ${CASE('t.type', { order_revenue: 'รายรับจากยอดขาย (หลังหัก GP)', commission: 'ค่าธรรมเนียมแพลตฟอร์ม (GP)', withdrawal: 'ถอนเงินออกจากกระเป๋า', refund: 'คืนเงินเข้ากระเป๋า', income: 'รายรับ' })},
       t.status_th = ${CASE('t.status', { pending: 'รอดำเนินการ', completed: 'สำเร็จ', failed: 'ไม่สำเร็จ/ถูกปฏิเสธ' })}`,
  `UPDATE wallet_transactions w
   SET w.type_th = ${CASE('w.type', { credit: 'เงินเข้า', debit: 'เงินออก' })}, w.user_type_th = ${CASE('w.user_type', { shop: 'กระเป๋าร้านค้า', rider: 'กระเป๋าไรเดอร์', system: 'ระบบ' })}`,
  `UPDATE shop_wallets sw JOIN shops s ON s.shop_id = sw.shop_id
   LEFT JOIN (SELECT target_id, SUM(amount) inc, COUNT(*) n FROM wallet_transactions WHERE user_type = 'shop' AND type = 'credit' GROUP BY target_id) c ON c.target_id = sw.shop_id
   LEFT JOIN (SELECT shop_id, SUM(IF(status = 'completed', amount, 0)) paid, SUM(IF(status = 'pending', amount, 0)) pend, SUM(IF(status = 'rejected', amount, 0)) rej FROM withdrawals WHERE shop_id IS NOT NULL GROUP BY shop_id) w ON w.shop_id = sw.shop_id
   SET sw.shop_name = s.name, sw.owner_name = s.owner_name,
       sw.total_income = COALESCE(c.inc, 0), sw.income_order_count = COALESCE(c.n, 0),
       sw.withdrawn_total = COALESCE(w.paid, 0), sw.pending_withdraw = COALESCE(w.pend, 0), sw.rejected_withdraw = COALESCE(w.rej, 0),
       sw.bank_info = CONCAT(COALESCE(s.bank_name, '-'), ' ', COALESCE(s.bank_account, '-'))`,
  `UPDATE rider_wallets rw JOIN riders r ON r.rider_id = rw.rider_id
   LEFT JOIN (SELECT target_id, SUM(IF(type = 'credit', amount, 0)) inc, SUM(IF(type = 'debit', amount, 0)) outc, SUM(type = 'credit') n FROM wallet_transactions WHERE user_type = 'rider' GROUP BY target_id) t ON t.target_id = rw.rider_id
   LEFT JOIN (SELECT rider_id, SUM(amount) pend FROM withdrawals WHERE status = 'pending' AND rider_id IS NOT NULL GROUP BY rider_id) w ON w.rider_id = rw.rider_id
   SET rw.rider_name = COALESCE(r.real_name, r.name),
       rw.total_income = COALESCE(t.inc, 0), rw.job_count = COALESCE(t.n, 0), rw.withdrawn_total = COALESCE(t.outc, 0),
       rw.pending_withdraw = COALESCE(w.pend, 0), rw.promptpay_phone = r.phone`,

  // ---------------- สมาชิก / แต้ม / คูปอง / ที่อยู่ ----------------
  `UPDATE user_addresses a JOIN users u ON u.user_id = a.user_id SET a.user_name = u.full_name`,
  `UPDATE user_point_history h JOIN users u ON u.user_id = h.user_id SET h.user_name = COALESCE(h.user_name, u.full_name)`,
  `UPDATE user_points p JOIN users u ON u.user_id = p.user_id
   LEFT JOIN (SELECT user_id, COUNT(*) n, MAX(id) last_id FROM user_point_history GROUP BY user_id) h ON h.user_id = p.user_id
   LEFT JOIN user_point_history hl ON hl.id = h.last_id
   LEFT JOIN (SELECT user_id, SUM(is_used = 0) avail, SUM(is_used = 1) used FROM user_coupons GROUP BY user_id) c ON c.user_id = p.user_id
   SET p.user_name = u.full_name, p.history_count = COALESCE(h.n, 0),
       p.last_change_at = hl.created_at, p.last_change_title = IF(hl.id IS NULL, NULL, CONCAT(hl.title, ' (', hl.points_change, ')')),
       p.coupons_available = COALESCE(c.avail, 0), p.coupons_used = COALESCE(c.used, 0)`,
  `UPDATE user_coupons c JOIN users u ON u.user_id = c.user_id LEFT JOIN orders o ON o.order_id = c.order_id
   SET c.user_name = u.full_name,
       c.status_th = IF(c.is_used = 1, 'ใช้แล้ว', 'ยังไม่ได้ใช้'),
       c.order_shop_name = IF(c.order_id IS NULL, 'ยังไม่ได้ใช้กับออเดอร์ใด', o.shop_name),
       c.order_total = o.total_amount`,

  // ---------------- ประมูล / แบนเนอร์ ----------------
  `UPDATE auction_bids b LEFT JOIN users u ON u.user_id = b.user_id LEFT JOIN auctions a ON a.auction_id = b.auction_id
   SET b.bidder_name = COALESCE(b.bidder_name, u.full_name), b.auction_title = COALESCE(b.auction_title, a.title),
       b.status_th = ${CASE('b.bid_status', { active: 'ราคาสูงสุดขณะนี้', outbid: 'มีคนเสนอสูงกว่า', won: 'ชนะการประมูล' })}`,
  `UPDATE auctions a LEFT JOIN users u ON u.user_id = a.winner_user_id
   LEFT JOIN (SELECT auction_id, COUNT(*) n FROM auction_bids GROUP BY auction_id) b ON b.auction_id = a.auction_id
   SET a.winner_name = COALESCE(u.full_name, IF(a.auction_status = 'ended', 'ไม่มีผู้ชนะ', 'ยังไม่มีผู้ชนะ')),
       a.status_th = ${CASE('a.auction_status', { active: 'กำลังประมูล', ended: 'ปิดประมูลแล้ว', cancelled: 'ยกเลิกการประมูล' })},
       a.bid_count = COALESCE(b.n, 0)`,
  `UPDATE banners SET status_th = IF(is_active = 1, 'แสดงอยู่ในแอป', 'ซ่อนอยู่')`,
];

/**
 * @param conn  connection ที่มี .query() (mysql2/promise connection หรือ pool)
 */
const syncReadable = async (conn) => {
  let failed = 0;
  for (const sql of STATEMENTS) {
    try { await conn.query(sql); } catch (e) { failed++; console.error('⚠️ [readable-sync]', e.message.slice(0, 200)); }
  }
  return { statements: STATEMENTS.length, failed };
};

// เรียกจาก server: จัดคิวไม่ให้รันซ้อน และรวบหลายคำขอติดกันเป็นครั้งเดียว
const makeScheduler = (db, delayMs = 1500) => {
  let timer = null; let running = false; let again = false;
  const run = async () => {
    if (running) { again = true; return; }
    running = true;
    try {
      const conn = await db.getConnection();
      try { await syncReadable(conn); } finally { conn.release(); }
    } catch (e) { console.error('⚠️ [readable-sync]', e.message); }
    running = false;
    if (again) { again = false; schedule(); }
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(run, delayMs); };
  return { schedule, runNow: run };
};

module.exports = { syncReadable, makeScheduler, STATEMENTS };
