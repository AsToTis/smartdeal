// ==========================================================
// Smart Deal - Readable columns sync
// เติม/อัปเดตคอลัมน์ภาษาไทย (ชื่อแทนรหัส, สถานะภาษาไทย, summary_th, timeline_th) ในทุกตาราง
// ใช้ SQL มาตรฐาน (UPDATE ... JOIN) จึงรันได้ทั้ง MariaDB (XAMPP) และ MySQL 8 โดยไม่ต้องใช้ trigger
//   - ข้อมูลหลัก (ร้าน เมนู ผู้ใช้ กระเป๋าเงิน ฯลฯ): คำนวณใหม่ทุกครั้งให้เป็นปัจจุบัน
//   - ข้อมูลประวัติ (ชื่อใน order_items, แชท, รีวิว ฯลฯ): เติมครั้งเดียวตอนยังว่าง = snapshot ณ เวลาเกิดเหตุการณ์
// ==========================================================
const DF = (x) => `DATE_FORMAT(${x}, '%d/%m/%Y %H:%i')`;
const M = (x) => `CONCAT('฿', FORMAT(COALESCE(${x}, 0), 2))`;
// ระยะทาง (กม.) จากจุดอ้างอิงของระบบ = พิกัดเริ่มต้นในฐานข้อมูล (ม.มหาสารคาม 16.246826, 103.251992)
const HAV = (lat, lng) => `6371 * 2 * ASIN(SQRT(POW(SIN(RADIANS(${lat} - 16.246826) / 2), 2) + COS(RADIANS(16.246826)) * COS(RADIANS(${lat})) * POW(SIN(RADIANS(${lng} - 103.251992) / 2), 2)))`;
const CASE = (expr, map, fallback) => `CASE ${expr} ${Object.entries(map).map(([k, v]) => `WHEN '${k}' THEN '${v}'`).join(' ')} ELSE ${fallback || expr} END`;

const ROLE = { buyer: 'ลูกค้า', seller: 'ร้านค้า', driver: 'ไรเดอร์', rider: 'ไรเดอร์', admin: 'ผู้ดูแลระบบ', system: 'ระบบอัตโนมัติ' };
const ORDER_ST = { new: 'เริ่มสร้างคำสั่งซื้อ', pending: 'รอร้านค้ารับออเดอร์', paid: 'ชำระเงินแล้ว รอร้านรับ', preparing: 'ร้านกำลังเตรียมสินค้า', ready: 'เตรียมเสร็จ รอไรเดอร์',
  finding_rider: 'กำลังหาไรเดอร์', delivering: 'ไรเดอร์กำลังนำส่ง', shipped: 'จัดส่งแล้ว', delivered: 'ส่งถึงแล้ว รอลูกค้ายืนยัน', completed: 'เสร็จสมบูรณ์', cancelled: 'ยกเลิกแล้ว' };

const STATEMENTS = [
  // ---------------- users ----------------
  `UPDATE users u
   LEFT JOIN (SELECT user_id, COUNT(*) n, SUM(order_status = 'completed') done, SUM(order_status = 'cancelled') cancel,
                     SUM(CASE WHEN order_status <> 'cancelled' THEN total_amount ELSE 0 END) spent, MAX(created_at) last_order
              FROM orders GROUP BY user_id) o ON o.user_id = u.user_id
   LEFT JOIN (SELECT owner_id, GROUP_CONCAT(CONCAT(name, ' (', ${CASE('status', { pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ถูกปฏิเสธ', suspended: 'ถูกระงับ' })}, ')') SEPARATOR ', ') shops FROM shops GROUP BY owner_id) s ON s.owner_id = u.user_id
   LEFT JOIN riders r ON r.user_id = u.user_id
   LEFT JOIN user_points p ON p.user_id = u.user_id
   LEFT JOIN (SELECT user_id, COUNT(*) n FROM user_addresses GROUP BY user_id) a ON a.user_id = u.user_id
   LEFT JOIN (SELECT user_id, SUM(quantity) q, SUM(line_total) amt FROM cart_items GROUP BY user_id) ct ON ct.user_id = u.user_id
   LEFT JOIN (SELECT user_id, COUNT(*) n, SUBSTRING_INDEX(GROUP_CONCAT(keyword ORDER BY id DESC SEPARATOR ', '), ', ', 3) kw FROM search_logs WHERE user_id IS NOT NULL GROUP BY user_id) sl ON sl.user_id = u.user_id
   SET u.role_th = ${CASE('u.role', ROLE)},
       u.status_th = ${CASE('u.status', { active: 'ใช้งานได้ปกติ', suspended: 'ถูกระงับการใช้งาน', deleted: 'ลบบัญชีแล้ว' })},
       u.summary_th = CONCAT_WS(' | ',
         CONCAT(u.full_name, ' (', ${CASE('u.role', ROLE)}, ')'),
         CONCAT('สถานะ: ', ${CASE('u.status', { active: 'ใช้งานได้ปกติ', suspended: 'ถูกระงับการใช้งาน', deleted: 'ลบบัญชีแล้ว' })}),
         CONCAT('โทร ', COALESCE(u.phone, '-')), CONCAT('อีเมล ', COALESCE(u.email, '-')),
         CONCAT('สมัครเมื่อ ', ${DF('u.created_at')}),
         CONCAT('เข้าสู่ระบบล่าสุด ', COALESCE(${DF('u.last_login')}, 'ยังไม่เคยเข้าสู่ระบบ')),
         IF(o.n IS NULL, IF(u.role IN ('buyer','seller'), 'ยังไม่เคยสั่งซื้อ', NULL),
            CONCAT('สั่งซื้อ ', o.n, ' ออเดอร์ (สำเร็จ ', o.done, ', ยกเลิก ', o.cancel, ') ยอดซื้อรวม ', ${M('o.spent')}, ' สั่งล่าสุด ', ${DF('o.last_order')})),
         IF(p.points IS NULL, NULL, CONCAT('แต้มสะสม ', p.points, ' แต้ม')),
         IF(a.n IS NULL, NULL, CONCAT('ที่อยู่จัดส่ง ', a.n, ' แห่ง')),
         IF(ct.q IS NULL, NULL, CONCAT('ตะกร้ามี ', ct.q, ' ชิ้น รวม ', ${M('ct.amt')})),
         IF(sl.n IS NULL, NULL, CONCAT('ค้นหา ', sl.n, ' ครั้ง ล่าสุด: ', sl.kw)),
         IF(s.shops IS NULL, NULL, CONCAT('เจ้าของร้าน: ', s.shops)),
         IF(r.rider_id IS NULL, NULL, CONCAT('ไรเดอร์ ', ${CASE('r.status', { pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ถูกปฏิเสธ' })}, ' รถ ', COALESCE(r.vehicle_type, '-'), ' ทะเบียน ', COALESCE(r.vehicle_plate, '-'))))`,

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
       p.price_th = CONCAT('ราคาเต็ม ', ${M('p.original_price')}, ' ลด ', COALESCE(p.discount_percent, 0), '% เหลือ ', ${M('p.discount_price')}),
       p.stock_th = IF(p.stock_quantity > 0, CONCAT('เหลือ ', p.stock_quantity, ' ชิ้น'), 'สินค้าหมด'),
       p.sold_qty = COALESCE(sold.q, 0),
       p.summary_th = CONCAT_WS(' | ', CONCAT(p.name, ' (ร้าน ', COALESCE(s.name, '-'), ', หมวด ', COALESCE(c.name, '-'), ')'),
         CONCAT('ราคาเต็ม ', ${M('p.original_price')}, ' ลด ', COALESCE(p.discount_percent, 0), '% เหลือ ', ${M('p.discount_price')}),
         IF(p.stock_quantity > 0, CONCAT('เหลือ ', p.stock_quantity, ' ชิ้น'), 'สินค้าหมด'),
         CONCAT('ขายไปแล้ว ', COALESCE(sold.q, 0), ' ชิ้น จาก ', COALESCE(sold.n, 0), ' ออเดอร์'),
         IF(p.expiry_time IS NULL, CONCAT('หมดอายุ: ', COALESCE(p.expiry_text, '-')), CONCAT('หมดอายุ ', ${DF('p.expiry_time')})),
         IF(p.is_auction = 1, 'เปิดประมูลด้วย', NULL))`,

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
       s.tag1 = COALESCE(c.name, s.tag1),
       s.tag2 = IF(COALESCE(p.maxd, 0) > 0, CONCAT('ลดสูงสุด ', p.maxd, '%'), 'ยังไม่มีดีลลดราคา'),
       s.distance = IF(s.latitude IS NULL, s.distance, CONCAT(ROUND(${HAV('s.latitude', 's.longitude')}, 1), ' กม.')),
       s.status_th = ${CASE('s.status', { pending: 'รอแอดมินตรวจสอบ', approved: 'อนุมัติแล้ว เปิดขายได้', rejected: 'ถูกปฏิเสธ', suspended: 'ถูกระงับโดยแอดมิน' })},
       s.open_th = IF(s.is_open = 1, 'เปิดรับออเดอร์', 'ปิดร้านชั่วคราว'),
       s.summary_th = CONCAT_WS(' | ', CONCAT('ร้าน ', s.name, ' (หมวด ', COALESCE(c.name, '-'), ')'),
         CONCAT('เจ้าของ ', COALESCE(u.full_name, '-'), ' โทร ', COALESCE(u.phone, '-')),
         CONCAT('สถานะ: ', ${CASE('s.status', { pending: 'รอแอดมินตรวจสอบ', approved: 'อนุมัติแล้ว', rejected: 'ถูกปฏิเสธ', suspended: 'ถูกระงับ' })}, ', ', IF(s.is_open = 1, 'เปิดรับออเดอร์', 'ปิดร้านชั่วคราว')),
         CONCAT('เวลาเปิด ', COALESCE(s.opening_hours, '-')), CONCAT('ที่อยู่ ', COALESCE(s.address, '-')),
         CONCAT('เมนู ', COALESCE(p.n, 0), ' รายการ (สต็อกรวม ', COALESCE(p.stock, 0), ' ชิ้น)'),
         CONCAT('ออเดอร์ ', COALESCE(o.n, 0), ' (สำเร็จ ', COALESCE(o.done, 0), ', ยกเลิก ', COALESCE(o.cancel, 0), ') ยอดขาย ', ${M('o.gross')}),
         CONCAT('เงินในกระเป๋า ', ${M('w.balance')}),
         IF(rv.n IS NULL, 'ยังไม่มีรีวิว', CONCAT('รีวิว ', rv.avg_r, '/5 จาก ', rv.n, ' รีวิว')),
         CONCAT('บัญชีรับเงิน ', COALESCE(s.bank_name, '-'), ' ', COALESCE(s.bank_account, '-')))`,

  // ---------------- riders ----------------
  `UPDATE riders r
   LEFT JOIN users u ON u.user_id = r.user_id
   LEFT JOIN (SELECT d.rider_id, COUNT(*) n, SUM(d.status IN ('delivered','completed')) done, SUM(IF(d.status = 'completed', o.delivery_fee, 0)) earned
              FROM deliveries d JOIN orders o ON o.order_id = d.order_id GROUP BY d.rider_id) d ON d.rider_id = r.rider_id
   LEFT JOIN (SELECT rider_id, ROUND(AVG(rider_rating), 1) avg_r, COUNT(rider_rating) n FROM reviews WHERE rider_rating IS NOT NULL GROUP BY rider_id) rv ON rv.rider_id = r.rider_id
   LEFT JOIN (SELECT rider_id, SUM(IF(status = 'completed', amount, 0)) paid, SUM(IF(status = 'pending', amount, 0)) pend FROM withdrawals WHERE rider_id IS NOT NULL GROUP BY rider_id) w ON w.rider_id = r.rider_id
   SET r.user_email = u.email,
       r.vehicle_detail = CONCAT(COALESCE(r.vehicle_type, '-'), ' ทะเบียน ', COALESCE(NULLIF(r.vehicle_plate, ''), '-')),
       r.status_th = ${CASE('r.status', { pending: 'รอแอดมินอนุมัติ', approved: 'อนุมัติแล้ว รับงานได้', rejected: 'ถูกปฏิเสธ' })},
       r.online_th = ${CASE('r.rider_status', { available: 'เปิดรับงาน (Online)', busy: 'กำลังวิ่งงาน', offline: 'ปิดรับงาน (Offline)' })},
       r.summary_th = CONCAT_WS(' | ', CONCAT('ไรเดอร์ ', COALESCE(r.real_name, r.name), ' โทร ', r.phone, ' อีเมล ', COALESCE(u.email, '-')),
         CONCAT('รถ ', COALESCE(r.vehicle_type, '-'), ' ทะเบียน ', COALESCE(r.vehicle_plate, '-'), ' ใบขับขี่ ', COALESCE(r.license_number, '-')),
         CONCAT('สถานะ: ', ${CASE('r.status', { pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ถูกปฏิเสธ' })}, IF(r.status = 'rejected', CONCAT(' (', COALESCE(r.reject_reason, '-'), ')'), '')),
         ${CASE('r.rider_status', { available: 'เปิดรับงาน', busy: 'กำลังวิ่งงาน', offline: 'ปิดรับงาน' })},
         CONCAT('รับงาน ', COALESCE(d.n, 0), ' งาน ส่งสำเร็จ ', COALESCE(d.done, 0), ' งาน'),
         CONCAT('รายได้ค่ารอบที่ลูกค้ายืนยันแล้ว ', ${M('d.earned')}, ' ถอนแล้ว ', ${M('w.paid')}, ' รอถอน ', ${M('w.pend')}),
         IF(rv.n IS NULL, 'ยังไม่มีคะแนนรีวิว', CONCAT('คะแนน ', rv.avg_r, '/5 จาก ', rv.n, ' รีวิว')),
         IF(r.current_lat IS NULL, 'ยังไม่มีพิกัด GPS', CONCAT('ตำแหน่งล่าสุด ', r.current_lat, ', ', r.current_lng, COALESCE(CONCAT(' เมื่อ ', ${DF('r.location_updated_at')}), ''), COALESCE(CONCAT(' ความเร็ว ', ROUND(r.last_speed_kmh), ' กม./ชม.'), ''))))`,

  // ---------------- orders ----------------
  `UPDATE orders o
   LEFT JOIN (SELECT order_id, GROUP_CONCAT(CONCAT('[', ${DF('created_at')}, '] ', description_th, ' (โดย ', COALESCE(actor_name, 'ระบบ'), ')') ORDER BY created_at, id SEPARATOR '\\n') tl
              FROM order_status_logs GROUP BY order_id) l ON l.order_id = o.order_id
   SET o.payment_status_th = ${CASE('o.payment_status', { pending: 'ยังไม่ชำระเงิน', paid: 'ชำระเงินแล้ว', failed: 'ชำระเงินไม่สำเร็จ', refunded: 'คืนเงินแล้ว' })},
       o.payment_method_th = ${CASE('o.payment_method', { promptpay: 'พร้อมเพย์ (สแกน QR)', cash: 'เงินสด', mobilebanking: 'โมบายแบงก์กิ้ง' })},
       o.delivery_type_th = ${CASE('o.delivery_type', { delivery: 'จัดส่งถึงที่อยู่', pickup: 'ลูกค้ารับเองที่ร้าน' })},
       o.timeline_th = COALESCE(l.tl, 'ยังไม่มีเหตุการณ์'),
       o.summary_th = CONCAT_WS(' | ', CONCAT('ออเดอร์ #', o.order_id, ' สั่งเมื่อ ', ${DF('o.created_at')}),
         CONCAT('ลูกค้า ', COALESCE(o.buyer_name, '-'), ' (ผู้รับ ', COALESCE(o.receiver_name, '-'), ' โทร ', COALESCE(o.receiver_phone, '-'), ')'),
         CONCAT('ร้าน ', COALESCE(o.shop_name, '-')), CONCAT('รายการ: ', COALESCE(o.items_summary, '-')),
         CONCAT('ค่าสินค้า ', ${M('o.subtotal')}, ' + ค่าส่ง ', ${M('o.delivery_fee')}, ' - ส่วนลด ', ${M('o.discount')}, ' = ', ${M('o.total_amount')}),
         CONCAT('ชำระ: ', ${CASE('o.payment_method', { promptpay: 'พร้อมเพย์', cash: 'เงินสด' })}, ' (', ${CASE('o.payment_status', { pending: 'ยังไม่ชำระ', paid: 'ชำระแล้ว' })}, ')'),
         CONCAT('คูปอง: ', COALESCE(o.coupon_code, '-')),
         CONCAT(${CASE('o.delivery_type', { delivery: 'จัดส่งที่', pickup: 'รับเองที่ร้าน' })}, ' ', COALESCE(o.shipping_address, '')),
         CONCAT('ไรเดอร์: ', COALESCE(o.rider_name, 'ยังไม่มี')),
         CONCAT('สถานะ: ', COALESCE(o.status_th, o.order_status)),
         IF(o.order_status = 'cancelled', CONCAT('ยกเลิกโดย ', COALESCE(o.cancelled_by, '-'), ' เหตุผล ', COALESCE(o.cancel_reason, '-')), NULL))`,

  // ---------------- order_items ----------------
  `UPDATE order_items oi JOIN orders o ON o.order_id = oi.order_id
   SET oi.buyer_name = COALESCE(oi.buyer_name, o.buyer_name),
       oi.order_created_at = COALESCE(oi.order_created_at, o.created_at),
       oi.order_status_th = COALESCE(o.status_th, o.order_status),
       oi.summary_th = CONCAT(oi.product_name, ' x', oi.quantity, ' @ ', ${M('oi.price')},
         IF(oi.original_price IS NULL, '', CONCAT(' (ราคาเต็ม ', ${M('oi.original_price')}, ' ลด ', COALESCE(oi.discount_percent, 0), '%)')),
         ' = ', ${M('COALESCE(oi.line_total, oi.price * oi.quantity)')}, ' | ร้าน ', COALESCE(oi.shop_name, '-'),
         ' | ออเดอร์ #', oi.order_id, ' ของ ', COALESCE(o.buyer_name, '-'), ' | ', COALESCE(o.status_th, o.order_status))`,

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
       d.summary_th = CONCAT_WS(' | ', CONCAT('งานส่งออเดอร์ #', d.order_id, ' โดย ', COALESCE(r.real_name, r.name, '-'), ' (โทร ', COALESCE(r.phone, '-'), ')'),
         CONCAT('รับของที่ ', COALESCE(o.shop_name, '-')), CONCAT('ส่งให้ ', COALESCE(o.buyer_name, '-'), ' ที่ ', COALESCE(o.shipping_address, '-')),
         CONCAT('ค่ารอบ ', ${M('o.delivery_fee')}),
         CONCAT('รับงาน ', COALESCE(${DF('d.assigned_at')}, '-')), CONCAT('รับของ ', COALESCE(${DF('d.pickup_at')}, 'ยังไม่รับ')), CONCAT('ส่งถึง ', COALESCE(${DF('d.completed_at')}, 'ยังไม่ส่ง')),
         CONCAT('รูปยืนยันรับของ: ', IF(d.pickup_proof_image IS NULL, 'ยังไม่มี', 'มี'), ', รูปยืนยันส่งของ: ', IF(d.proof_image IS NULL OR d.proof_image = '', 'ยังไม่มี', 'มี')))`,

  // ---------------- payments / receipts ----------------
  `UPDATE payments p JOIN orders o ON o.order_id = p.order_id
   SET p.shop_name = COALESCE(p.shop_name, o.shop_name), p.payer_name = COALESCE(p.payer_name, o.buyer_name),
       p.status_th = ${CASE('p.payment_status', { pending: 'รอชำระ', success: 'ชำระสำเร็จ', failed: 'ชำระไม่สำเร็จ' })},
       p.method_th = ${CASE('p.payment_method', { promptpay: 'พร้อมเพย์ (สแกน QR)', cash: 'เงินสด', mobilebanking: 'โมบายแบงก์กิ้ง' })},
       p.description = COALESCE(p.description, CONCAT(o.buyer_name, ' ชำระเงินออเดอร์ #', o.order_id, ' ', ${M('p.amount')}))`,
  `UPDATE receipts rc JOIN orders o ON o.order_id = rc.order_id
   SET rc.buyer_name = COALESCE(rc.buyer_name, o.buyer_name), rc.shop_name = COALESCE(rc.shop_name, o.shop_name),
       rc.total_amount = COALESCE(rc.total_amount, o.total_amount), rc.items_summary = COALESCE(rc.items_summary, o.items_summary),
       rc.summary_th = CONCAT('ใบเสร็จ ', rc.receipt_number, ' ออกเมื่อ ', ${DF('rc.issued_at')}, ' | ', COALESCE(o.buyer_name, '-'), ' ซื้อจาก ', COALESCE(o.shop_name, '-'),
         ' : ', COALESCE(o.items_summary, '-'), ' | ยอดรวม ', ${M('o.total_amount')})`,

  // ---------------- reviews ----------------
  `UPDATE reviews rv LEFT JOIN orders o ON o.order_id = rv.order_id LEFT JOIN riders r ON r.rider_id = rv.rider_id
   LEFT JOIN users u ON u.user_id = rv.user_id LEFT JOIN shops s ON s.shop_id = rv.shop_id
   SET rv.reviewer_name = COALESCE(rv.reviewer_name, u.full_name), rv.shop_name = COALESCE(rv.shop_name, s.name),
       rv.rider_name = COALESCE(rv.rider_name, r.real_name, r.name), rv.items_summary = COALESCE(rv.items_summary, o.items_summary),
       rv.summary_th = CONCAT_WS(' | ', CONCAT(COALESCE(rv.reviewer_name, u.full_name, '-'), ' ให้ร้าน ', COALESCE(rv.shop_name, s.name, '-'), ' ', rv.rating, '/5 ดาว'),
         CONCAT('ความเห็น: ', IF(rv.comment = '' OR rv.comment IS NULL, '-', rv.comment)),
         IF(rv.rider_rating IS NULL, NULL, CONCAT('ให้ไรเดอร์ ', COALESCE(r.real_name, r.name, '-'), ' ', rv.rider_rating, '/5', IF(rv.rider_comment IS NULL, '', CONCAT(' "', rv.rider_comment, '"')))),
         IF(rv.order_id IS NULL, NULL, CONCAT('ออเดอร์ #', rv.order_id, ': ', COALESCE(o.items_summary, '-'))),
         IF(rv.image_url IS NULL, 'ไม่มีรูป', 'แนบรูป'), CONCAT('เมื่อ ', ${DF('rv.created_at')}))`,

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
       i.order_summary = COALESCE(o.summary_th, CONCAT('ออเดอร์ #', i.order_id))`,
  `UPDATE complaints c LEFT JOIN users u ON u.user_id = c.user_id LEFT JOIN orders o ON o.order_id = c.order_id
   SET c.reporter_name = COALESCE(c.reporter_name, u.full_name), c.reporter_phone = COALESCE(c.reporter_phone, u.phone),
       c.status_th = ${CASE('c.status', { pending: 'รอดำเนินการ', in_progress: 'แอดมินกำลังดำเนินการ', resolved: 'แก้ไขเรียบร้อยแล้ว' })},
       c.order_summary = IF(c.order_id IS NULL, 'เรื่องทั่วไป ไม่เกี่ยวกับออเดอร์', COALESCE(o.summary_th, CONCAT('ออเดอร์ #', c.order_id)))`,
  `UPDATE refund_requests rf LEFT JOIN orders o ON o.order_id = rf.order_id LEFT JOIN users u ON u.user_id = rf.user_id
   SET rf.requester_name = COALESCE(rf.requester_name, u.full_name), rf.shop_name = COALESCE(rf.shop_name, o.shop_name),
       rf.status_th = ${CASE('rf.status', { pending: 'รอแอดมินตรวจสอบ', approved: 'อนุมัติคืนเงินแล้ว', rejected: 'ปฏิเสธการคืนเงิน' })},
       rf.order_summary = COALESCE(o.summary_th, CONCAT('ออเดอร์ #', rf.order_id))`,

  // ---------------- notifications ----------------
  `UPDATE notifications n
   LEFT JOIN orders o ON n.type IN ('order','order_status','refund','refund_request','auction_won') AND o.order_id = n.reference_id
   LEFT JOIN auctions a ON n.type IN ('auction_lost','auction_outbid') AND a.auction_id = n.reference_id
   LEFT JOIN shops s ON n.type LIKE 'shop_%' AND s.shop_id = n.reference_id
   LEFT JOIN withdrawals w ON n.type = 'withdrawal' AND w.id = n.reference_id
   SET n.type_th = ${CASE('n.type', { order: 'อัปเดตคำสั่งซื้อ', order_status: 'อัปเดตคำสั่งซื้อ', auction_won: 'ชนะการประมูล', auction_lost: 'แพ้การประมูล', auction_outbid: 'มีคนเสนอราคาสูงกว่า',
     shop_approved: 'ร้านได้รับอนุมัติ', shop_rejected: 'ร้านถูกปฏิเสธ', shop_suspended: 'ร้านถูกระงับ', rider_approved: 'ไรเดอร์ได้รับอนุมัติ', rider_rejected: 'ไรเดอร์ถูกปฏิเสธ',
     withdrawal: 'การถอนเงิน', refund: 'การคืนเงิน', refund_request: 'ขอคืนเงินได้', complaint: 'เรื่องร้องเรียน', account_status: 'สถานะบัญชี', general: 'ทั่วไป', message: 'ข้อความใหม่', review: 'รีวิวใหม่' })},
       n.related_summary = COALESCE(o.summary_th,
         IF(a.auction_id IS NULL, NULL, CONCAT('ประมูล "', a.title, '" ราคาล่าสุด ', ${M('a.current_bid')})),
         IF(s.shop_id IS NULL, NULL, CONCAT('ร้าน ', s.name, ' สถานะ ', COALESCE(s.status_th, s.status))),
         IF(w.id IS NULL, NULL, CONCAT('คำขอถอนเงิน #', w.id, ' ', ${M('w.amount')}, ' ของ ', COALESCE(w.requester_name, '-'))),
         'ไม่มีข้อมูลอ้างอิงเพิ่มเติม')`,

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
       sw.summary_th = CONCAT('ร้าน ', s.name, ' | คงเหลือ ', ${M('sw.balance')}, ' | รายรับสุทธิทั้งหมด ', ${M('c.inc')}, ' จาก ', COALESCE(c.n, 0), ' ออเดอร์',
         ' | ถอนสำเร็จ ', ${M('w.paid')}, ' | รออนุมัติ ', ${M('w.pend')}, ' | ถูกปฏิเสธ(คืนยอดแล้ว) ', ${M('w.rej')}, ' | บัญชี ', COALESCE(s.bank_name, '-'), ' ', COALESCE(s.bank_account, '-'))`,
  `UPDATE rider_wallets rw JOIN riders r ON r.rider_id = rw.rider_id
   LEFT JOIN (SELECT target_id, SUM(IF(type = 'credit', amount, 0)) inc, SUM(IF(type = 'debit', amount, 0)) outc, SUM(type = 'credit') n FROM wallet_transactions WHERE user_type = 'rider' GROUP BY target_id) t ON t.target_id = rw.rider_id
   LEFT JOIN (SELECT rider_id, SUM(amount) pend FROM withdrawals WHERE status = 'pending' AND rider_id IS NOT NULL GROUP BY rider_id) w ON w.rider_id = rw.rider_id
   SET rw.rider_name = COALESCE(r.real_name, r.name),
       rw.summary_th = CONCAT('ไรเดอร์ ', COALESCE(r.real_name, r.name), ' | คงเหลือ ', ${M('rw.balance')}, ' | ค่ารอบทั้งหมด ', ${M('t.inc')}, ' จาก ', COALESCE(t.n, 0), ' งาน',
         ' | ถอนแล้ว ', ${M('t.outc')}, ' | รออนุมัติ ', ${M('w.pend')}, ' | รับเงินทางพร้อมเพย์ ', r.phone)`,

  // ---------------- สมาชิก / แต้ม / คูปอง / ที่อยู่ ----------------
  `UPDATE user_addresses a JOIN users u ON u.user_id = a.user_id SET a.user_name = u.full_name`,
  `UPDATE user_point_history h JOIN users u ON u.user_id = h.user_id SET h.user_name = COALESCE(h.user_name, u.full_name)`,
  `UPDATE user_points p JOIN users u ON u.user_id = p.user_id
   LEFT JOIN (SELECT user_id, COUNT(*) n, MAX(created_at) last FROM user_point_history GROUP BY user_id) h ON h.user_id = p.user_id
   LEFT JOIN (SELECT user_id, SUM(is_used = 0) avail, SUM(is_used = 1) used FROM user_coupons GROUP BY user_id) c ON c.user_id = p.user_id
   SET p.user_name = u.full_name,
       p.summary_th = CONCAT(u.full_name, ' มี ', p.points, ' แต้ม | ประวัติแต้ม ', COALESCE(h.n, 0), ' รายการ (ล่าสุด ', COALESCE(${DF('h.last')}, '-'), ')',
         ' | คูปองใช้ได้ ', COALESCE(c.avail, 0), ' ใบ ใช้แล้ว ', COALESCE(c.used, 0), ' ใบ')`,
  `UPDATE user_coupons c JOIN users u ON u.user_id = c.user_id LEFT JOIN orders o ON o.order_id = c.order_id
   SET c.user_name = u.full_name,
       c.status_th = IF(c.is_used = 1, CONCAT('ใช้แล้ว', COALESCE(CONCAT(' เมื่อ ', ${DF('c.used_at')}), '')), 'ยังไม่ได้ใช้'),
       c.order_summary = IF(c.order_id IS NULL, 'ยังไม่ได้ใช้กับออเดอร์ใด', COALESCE(o.summary_th, CONCAT('ออเดอร์ #', c.order_id)))`,

  // ---------------- ประมูล / แบนเนอร์ ----------------
  `UPDATE auction_bids b LEFT JOIN users u ON u.user_id = b.user_id LEFT JOIN auctions a ON a.auction_id = b.auction_id
   SET b.bidder_name = COALESCE(b.bidder_name, u.full_name), b.auction_title = COALESCE(b.auction_title, a.title),
       b.status_th = ${CASE('b.bid_status', { active: 'ราคาสูงสุดขณะนี้', outbid: 'มีคนเสนอสูงกว่า', won: 'ชนะการประมูล' })}`,
  `UPDATE auctions a LEFT JOIN users u ON u.user_id = a.winner_user_id
   LEFT JOIN (SELECT auction_id, COUNT(*) n FROM auction_bids GROUP BY auction_id) b ON b.auction_id = a.auction_id
   SET a.winner_name = COALESCE(u.full_name, IF(a.auction_status = 'ended', 'ไม่มีผู้ชนะ', 'ยังไม่มีผู้ชนะ')),
       a.status_th = ${CASE('a.auction_status', { active: 'กำลังประมูล', ended: 'ปิดประมูลแล้ว', cancelled: 'ยกเลิกการประมูล' })},
       a.bid_count = COALESCE(b.n, 0),
       a.summary_th = CONCAT('ประมูล "', a.title, '" ร้าน ', COALESCE(a.shop_name, '-'), ' | เริ่ม ', ${M('a.start_price')}, ' ราคาล่าสุด ', ${M('a.current_bid')},
         ' | เสนอราคา ', COALESCE(b.n, 0), ' ครั้ง | ปิด ', ${DF('a.end_time')}, ' | ผู้ชนะ ', COALESCE(u.full_name, '-'))`,
  `UPDATE banners SET status_th = IF(is_active = 1, 'แสดงอยู่ในแอป', 'ซ่อนอยู่')`,
];

/**
 * @param conn  connection ที่มี .query() (mysql2/promise connection หรือ pool)
 */
const syncReadable = async (conn) => {
  try { await conn.query('SET SESSION group_concat_max_len = 1000000'); } catch (e) { /* ignore */ }
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
