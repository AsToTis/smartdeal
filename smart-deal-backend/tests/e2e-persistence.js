// ==========================================================
// Smart Deal - End-to-End persistence test
// ยิง API จริงตาม flow: ลูกค้าสั่ง -> จ่ายเงิน -> ร้านรับ/ทำ -> ไรเดอร์รับ/ส่ง -> ลูกค้ายืนยัน -> แอดมินตรวจ
// แล้วตรวจว่าทุกเหตุการณ์ถูกบันทึกลง MySQL เป็นภาษาไทยครบ
//
// ใช้กับฐานทดสอบเท่านั้น!  ตัวอย่าง:
//   DB_LOCAL_NAME=db244_e2e PORT=5055 node smart-deal-backend/src/server.js
//   E2E_BASE=http://localhost:5055 DB_LOCAL_NAME=db244_e2e node smart-deal-backend/tests/e2e-persistence.js
// ==========================================================
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { resolveDbConfig } = require('../db/config');

const BASE = (process.env.E2E_BASE || 'http://localhost:5055') + '/api';
const cfg = resolveDbConfig();
if (!/e2e|test/i.test(cfg.database) && process.env.E2E_ALLOW_ANY_DB !== '1') {
  console.error(`❌ ปฏิเสธการรันบนฐาน "${cfg.database}" (ต้องเป็นฐานทดสอบที่มีคำว่า e2e/test)`);
  process.exit(1);
}

const results = [];
const check = (name, cond, detail = '') => { results.push({ step: name, ok: cond ? '✅' : '❌', detail: String(detail).slice(0, 120) }); };
const call = async (method, path, body, headers = {}) => {
  const res = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json', 'User-Agent': 'okhttp/4.12 (SmartDeal E2E Android)', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null; try { data = await res.json(); } catch (e) { /* ignore */ }
  return { status: res.status, data };
};

(async () => {
  const db = await mysql.createConnection({ host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database, charset: 'utf8mb4', dateStrings: true });
  const q = async (sql, p) => (await db.query(sql, p))[0];
  const stamp = Date.now().toString().slice(-6);
  const pw = await bcrypt.hash('Test1234', 10);

  // ---------- Setup: ผู้ใช้ทดสอบ ----------
  const mkUser = async (name, role, email, phone) => (await q('INSERT INTO users (email, phone, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, ?, "active")', [email, phone, pw, name, role])).insertId;
  const buyerId = await mkUser(`สมหญิง ทดสอบระบบ ${stamp}`, 'buyer', `buyer${stamp}@e2e.test`, `090${stamp}1`.slice(0, 10));
  const sellerId = await mkUser(`สมชาย เจ้าของร้าน ${stamp}`, 'seller', `seller${stamp}@e2e.test`, `091${stamp}2`.slice(0, 10));
  const riderUserId = await mkUser(`ไรเดอร์ วิ่งไว ${stamp}`, 'driver', `rider${stamp}@e2e.test`, `092${stamp}3`.slice(0, 10));
  const shopId = (await q('INSERT INTO shops (name, owner_id, status, address, bank_name, bank_account, latitude, longitude) VALUES (?, ?, "approved", "ถนนทดสอบ มหาสารคาม", "กสิกรไทย", "123-4-56789-0", 16.2468, 103.2519)', [`ร้านข้าวมันไก่ทดสอบ ${stamp}`, sellerId])).insertId;
  const productId = (await q('INSERT INTO products (shop_id, category_id, name, original_price, discount_price, discount_percent, stock_quantity) VALUES (?, 2, ?, 60, 45, 25, 10)', [shopId, 'ข้าวมันไก่ต้ม'])).insertId;
  const product2Id = (await q('INSERT INTO products (shop_id, category_id, name, original_price, discount_price, discount_percent, stock_quantity) VALUES (?, 4, ?, 30, 25, 17, 5)', [shopId, 'ชาเย็น'])).insertId;
  const riderId = (await q('INSERT INTO riders (user_id, vehicle_type, license_plate, vehicle_plate, name, real_name, phone, status, rider_status) VALUES (?, "motorcycle", "1กข 1234", "1กข 1234", ?, ?, ?, "approved", "available")', [riderUserId, `ไรเดอร์ วิ่งไว ${stamp}`, `วิ่งไว ใจดี ${stamp}`, `092${stamp}3`.slice(0, 10)])).insertId;
  const pendingShopOwner = await mkUser(`ผู้สมัครร้าน ${stamp}`, 'buyer', `apply${stamp}@e2e.test`, `093${stamp}4`.slice(0, 10));

  // ---------- 1. Login ทุก Role ----------
  let r = await call('POST', '/login', { identifier: `buyer${stamp}@e2e.test`, password: 'wrong' });
  check('ลูกค้าล็อกอินผิดรหัส', r.status === 400);
  r = await call('POST', '/login', { identifier: `buyer${stamp}@e2e.test`, password: 'Test1234' });
  check('ลูกค้าล็อกอิน', r.status === 200, r.data?.message);
  r = await call('POST', '/login', { identifier: `seller${stamp}@e2e.test`, password: 'Test1234' });
  check('ร้านค้าล็อกอิน', r.data?.user?.is_seller === true, r.data?.message);
  r = await call('POST', '/rider/login', { email: `rider${stamp}@e2e.test`, password: 'Test1234' });
  check('ไรเดอร์ล็อกอิน', r.status === 200, r.data?.message);
  r = await call('POST', '/admin/login', { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'admin1234' });
  const adminHeaders = { 'X-Admin-Name': encodeURIComponent('แอดมิน ทดสอบ E2E'), 'User-Agent': 'Mozilla/5.0 Chrome (E2E admin web)' };
  check('แอดมินล็อกอิน', r.status === 200, r.data?.message);
  if (r.data?.admin?.admin_id) adminHeaders['X-Admin-Id'] = String(r.data.admin.admin_id);

  // ---------- 2. ลูกค้าสั่งซื้อ + จ่ายเงิน ----------
  r = await call('POST', '/orders', {
    user_id: buyerId, shop_id: shopId, subtotal: 115, delivery_fee: 20, discount: 0, total_amount: 135,
    delivery_type: 'delivery', payment_method: 'promptpay', receiver_name: 'สมหญิง', receiver_phone: '0901111111',
    shipping_address: 'หอพักทดสอบ ห้อง 101', latitude: 16.25, longitude: 103.25, note_for_rider: 'ฝากไว้ที่ป้อม',
    items: [{ product_id: productId, quantity: 2, price: 45 }, { product_id: product2Id, quantity: 1, price: 25 }],
  });
  const orderId = r.data?.order_id;
  check('ลูกค้าสร้างออเดอร์', !!orderId, r.data?.message);
  r = await call('POST', '/payment/generate-qr', { order_id: orderId, total_amount: 135 });
  check('สร้าง QR ชำระเงิน', !!r.data?.charge_id);
  r = await call('POST', '/payment/webhook', { charge_id: r.data?.charge_id, status: 'successful' });
  check('ชำระเงินสำเร็จ (webhook)', r.data?.success);

  // ---------- 3. ร้านรับ -> เตรียมเสร็จ ----------
  r = await call('PUT', `/orders/${orderId}/status`, { order_status: 'preparing', shop_id: shopId });
  check('ร้านกดรับออเดอร์', r.data?.success);
  r = await call('PUT', `/orders/${orderId}/status`, { order_status: 'ready', shop_id: shopId });
  check('ร้านเตรียมสินค้าเสร็จ', r.data?.success);

  // ---------- 4. ไรเดอร์ รับงาน -> รับของ -> ส่งสำเร็จ ----------
  r = await call('PUT', `/rider/deliveries/${orderId}/status`, { rider_id: riderId, status: 'accepted' });
  check('ไรเดอร์กดรับงาน', r.data?.success, r.data?.message);
  r = await call('POST', `/rider/deliveries/${orderId}/pickup`, { rider_id: riderId, shop_id: shopId, pickup_proof_image: 'data:image/png;base64,iVBORw0KGgo=', is_all_picked_up: true });
  check('ไรเดอร์รับสินค้าจากร้าน', r.data?.success, r.data?.message);
  r = await call('POST', `/rider/deliveries/${orderId}/complete`, { rider_id: riderId, proof_image_base64: 'data:image/png;base64,iVBORw0KGgo=' });
  check('ไรเดอร์ส่งสินค้าถึงลูกค้า', r.data?.success, r.data?.message);

  r = await call('PUT', `/rider/${riderId}/online-status`, { is_online: false });
  const [rs] = await q('SELECT rider_status FROM riders WHERE rider_id = ?', [riderId]);
  check('ไรเดอร์ปิดรับงาน (บันทึก DB)', r.data?.success && rs.rider_status === 'offline', rs.rider_status);
  const riderToken = Buffer.from(`${riderUserId}-${Date.now()}`).toString('base64');
  r = await call('GET', '/rider/notifications/unread', null, { Authorization: `Bearer ${riderToken}` });
  const firstBatch = (r.data?.notifications || []).length;
  r = await call('GET', '/rider/notifications/unread', null, { Authorization: `Bearer ${riderToken}` });
  check('แจ้งเตือนไรเดอร์ส่งถึงเครื่องครั้งเดียว', firstBatch >= 0 && (r.data?.notifications || []).length === 0, `ครั้งแรก ${firstBatch} รายการ`);

  // ---------- 5. ลูกค้ายืนยันรับ + รีวิว ----------
  r = await call('PUT', `/orders/${orderId}/complete`);
  check('ลูกค้ายืนยันรับสินค้า', r.data?.success, r.data?.message);
  r = await call('POST', '/reviews', { order_id: orderId, user_id: buyerId, shop_id: shopId, rating: 5, comment: 'อร่อยมาก ส่งไว', rider_id: riderId, rider_rating: 5, rider_comment: 'สุภาพ' });
  check('ลูกค้ารีวิว', r.data?.success);
  r = await call('POST', '/rider/wallet/withdraw', { rider_id: riderId, amount: 5 });
  const [rw] = await q('SELECT requester_name, bank_info FROM withdrawals WHERE rider_id = ? ORDER BY id DESC LIMIT 1', [riderId]);
  check('ไรเดอร์ขอถอนเงิน (มีชื่อ/บัญชี)', r.data?.success && rw?.requester_name, rw ? `${rw.requester_name} / ${rw.bank_info}` : r.data?.message);
  r = await call('GET', `/orders/user/${buyerId}`);
  check('สถานะรีวิวมาจาก DB (is_reviewed)', (r.data?.data || []).some(o => o.order_id === orderId && Number(o.is_reviewed) === 1));

  // ---------- 6. ออเดอร์ที่ 2: ร้านยกเลิก (ต้องคืนสต็อก) ----------
  r = await call('POST', '/orders', { user_id: buyerId, shop_id: shopId, subtotal: 45, delivery_fee: 20, total_amount: 65, delivery_type: 'delivery', items: [{ product_id: productId, quantity: 1, price: 45 }] });
  const order2 = r.data?.order_id;
  const [stockBefore] = await q('SELECT stock_quantity FROM products WHERE product_id = ?', [productId]);
  r = await call('PUT', `/orders/${order2}/status`, { order_status: 'cancelled', shop_id: shopId, reason: 'วัตถุดิบหมด' });
  const [stockAfter] = await q('SELECT stock_quantity FROM products WHERE product_id = ?', [productId]);
  check('ร้านยกเลิกออเดอร์ + คืนสต็อก', r.data?.success && stockAfter.stock_quantity === stockBefore.stock_quantity + 1, `${stockBefore.stock_quantity} -> ${stockAfter.stock_quantity}`);

  // ---------- 7. ร้านจัดการเมนู/ร้าน/การเงิน ----------
  r = await call('POST', `/shops/${shopId}/products/${productId}`, { discount_price: 39, stock_quantity: 20 });
  check('ร้านแก้ราคา/สต็อก', r.data?.success);
  r = await call('PUT', `/seller/toggle-status/${shopId}`, { is_open: false });
  check('ร้านปิดร้านชั่วคราว', r.data?.success);
  r = await call('GET', `/seller/wallet/${shopId}`);
  const walletBefore = Number(r.data?.balance || 0);
  check('ร้านมียอดเงินจากออเดอร์', walletBefore > 0, walletBefore);
  r = await call('POST', '/seller/wallet/withdraw', { shop_id: shopId, amount: 10 });
  check('ร้านขอถอนเงิน', r.data?.success, r.data?.message);
  const [w] = await q('SELECT id FROM withdrawals WHERE shop_id = ? ORDER BY id DESC LIMIT 1', [shopId]);

  // ---------- 8. แอดมิน ----------
  r = await call('POST', `/admin/withdrawals/${w.id}/reject`, { reason: 'ชื่อบัญชีไม่ตรงกับชื่อร้าน' }, adminHeaders);
  check('แอดมินปฏิเสธถอนเงิน', r.data?.success, r.data?.message);
  r = await call('GET', `/seller/wallet/${shopId}`);
  check('เงินคืนเข้ากระเป๋าร้านหลังถูกปฏิเสธ', Math.abs(Number(r.data?.balance || 0) - walletBefore) < 0.01, `${walletBefore} -> ${r.data?.balance}`);
  r = await call('POST', '/shops/register', { owner_id: pendingShopOwner, name: `ร้านขนมไทยทดสอบ ${stamp}`, address: 'ตลาดทดสอบ', bank_name: 'ไทยพาณิชย์', bank_account: '999-9-99999-9' });
  const newShopId = r.data?.shop_id;
  check('ผู้ใช้สมัครเปิดร้าน', !!newShopId, r.data?.message);
  r = await call('PUT', `/admin/shops/${newShopId}/approve`, {}, adminHeaders);
  check('แอดมินอนุมัติร้าน', r.data?.success, r.data?.message);
  r = await call('PUT', `/admin/users/${pendingShopOwner}/status`, { status: 'suspended' }, adminHeaders);
  const [sus] = await q('SELECT status FROM users WHERE user_id = ?', [pendingShopOwner]);
  check('แอดมินระงับผู้ใช้ (ENUM suspended)', sus.status === 'suspended', sus.status);
  r = await call('POST', '/login', { identifier: `apply${stamp}@e2e.test`, password: 'Test1234' });
  check('ผู้ใช้ที่ถูกระงับล็อกอินไม่ได้', r.status === 403);
  r = await call('PUT', `/admin/orders/${order2}/note`, { note: 'ตรวจสอบแล้ว ลูกค้าได้รับแจ้งการยกเลิก' }, adminHeaders);
  check('แอดมินบันทึกโน้ตออเดอร์', r.data?.success, r.data?.message);

  // ---------- 9. แจ้งเตือน ----------
  const [n1] = await q('SELECT notification_id FROM notifications WHERE user_id = ? ORDER BY notification_id LIMIT 1', [buyerId]);
  if (n1) {
    await call('PUT', `/notifications/${n1.notification_id}/read`);
    r = await call('DELETE', `/notifications/${n1.notification_id}`);
    const [nr] = await q('SELECT is_read, read_at, is_deleted FROM notifications WHERE notification_id = ?', [n1.notification_id]);
    check('อ่าน/ลบแจ้งเตือน (เก็บประวัติ)', r.data?.success && nr.read_at && nr.is_deleted === 1, JSON.stringify(nr));
  }
  r = await call('PUT', `/users/${buyerId}/app-settings`, { pushEnabled: false });
  check('ตั้งค่าแอปบันทึกลง DB', r.data?.success);

  // ---------- ตรวจผลในฐานข้อมูล ----------
  const timeline = await q('SELECT created_at AS เวลา, actor_name AS ผู้ดำเนินการ, description_th AS เหตุการณ์ FROM order_status_logs WHERE order_id = ? ORDER BY id', [orderId]);
  const [ord] = await q(`SELECT order_id, buyer_name, shop_name, rider_name, items_summary, status_th, created_at, paid_at, accepted_at, prepared_at, rider_assigned_at, picked_up_at, delivered_at, completed_at FROM orders WHERE order_id = ?`, [orderId]);
  const [ord2] = await q('SELECT status_th, cancelled_at, cancel_reason, cancelled_by FROM orders WHERE order_id = ?', [order2]);
  const tsCols = ['paid_at', 'accepted_at', 'prepared_at', 'rider_assigned_at', 'picked_up_at', 'delivered_at', 'completed_at'];
  check('orders มีเวลาครบทุกสเต็ป', tsCols.every(c => ord[c]), tsCols.filter(c => !ord[c]).join(',') || 'ครบ');
  check('orders ยกเลิกมีเหตุผล/ผู้ยกเลิก', ord2.cancelled_at && ord2.cancel_reason && ord2.cancelled_by, `${ord2.cancel_reason} / ${ord2.cancelled_by}`);
  const items = await q('SELECT product_name, shop_name, price, original_price, discount_percent, quantity, line_total FROM order_items WHERE order_id = ?', [orderId]);
  check('order_items snapshot ราคา ณ ตอนสั่ง', items.every(i => i.shop_name && i.original_price && i.line_total));
  const logins = await q('SELECT full_name, role_th, app_name, is_success, fail_reason, ip_address, device_info FROM login_logs WHERE user_id IN (?, ?, ?) OR login_identifier LIKE ? ORDER BY id', [buyerId, sellerId, riderUserId, `%${stamp}%`]);
  check('login_logs ครบทุก Role', ['ลูกค้า', 'ร้านค้า', 'ไรเดอร์'].every(rt => logins.some(l => l.role_th === rt && l.is_success)), logins.length + ' แถว');
  const adminLogins = await q('SELECT COUNT(*) AS n FROM login_logs WHERE role = "admin" AND created_at >= NOW() - INTERVAL 5 MINUTE');
  check('login_logs แอดมิน', adminLogins[0].n > 0);
  const notifs = await q('SELECT recipient_name, recipient_role, title, is_read, read_at FROM notifications WHERE user_id IN (?, ?, ?, ?) ORDER BY notification_id', [buyerId, sellerId, riderUserId, pendingShopOwner]);
  check('notifications มีชื่อผู้รับ', notifs.length > 0 && notifs.every(n => n.recipient_name), notifs.length + ' แถว');
  const money = await q('SELECT type, status, amount, description FROM transactions WHERE shop_id = ? ORDER BY transaction_id', [shopId]);
  check('transactions รายรับ/GP/ถอน/คืนเงิน', ['order_revenue', 'commission', 'withdrawal', 'refund'].every(t => money.some(m => m.type === t)), money.map(m => m.type).join(','));
  const wallet = await q('SELECT user_type, target_name, amount, type, description FROM wallet_transactions WHERE order_id = ?', [orderId]);
  check('wallet_transactions ร้าน+ไรเดอร์', wallet.some(x => x.user_type === 'shop') && wallet.some(x => x.user_type === 'rider'));
  const pay = await q('SELECT payer_name, amount, paid_at, description FROM payments WHERE order_id = ?', [orderId]);
  check('payments บันทึกการชำระ', pay.length === 1 && pay[0].paid_at);
  const audits = await q('SELECT actor_type, actor_name, action_th, description_th FROM admin_audit_logs WHERE entity_id IN (?, ?, ?, ?, ?, ?) OR actor_name LIKE ? ORDER BY id', [String(productId), String(shopId), String(newShopId), String(pendingShopOwner), String(w.id), String(order2), '%E2E%']);
  check('admin_audit_logs แอดมิน+ร้านค้า', audits.some(a => a.actor_type === 'admin') && audits.some(a => a.actor_type === 'seller'), audits.length + ' แถว');

  console.log('\n================ ผลการทดสอบ ================');
  console.table(results);
  console.log(`\n📦 ออเดอร์ #${orderId}`); console.table([ord]);
  console.log('🕒 ไทม์ไลน์ order_status_logs'); console.table(timeline);
  console.log('🧾 order_items'); console.table(items);
  console.log('🔐 login_logs'); console.table(logins);
  console.log('🔔 notifications'); console.table(notifs.slice(-8));
  console.log('💰 transactions (สมุดบัญชีร้าน)'); console.table(money);
  console.log('👛 wallet_transactions'); console.table(wallet);
  console.log('💳 payments'); console.table(pay);
  console.log('🛡️ admin_audit_logs'); console.table(audits);
  await db.end();
  const failed = results.filter(x => x.ok !== '✅').length;
  console.log(failed ? `\n❌ ไม่ผ่าน ${failed} ข้อ` : `\n✅ ผ่านทั้งหมด ${results.length} ข้อ`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('❌ E2E error:', e); process.exit(1); });
