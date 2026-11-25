// ==========================================================
// Smart Deal - ข้อมูลตัวอย่าง "เหมือนใช้งานจริง" ผ่าน API จริงทุกขั้นตอน
// ทุกตาราง log จะถูกเขียนโดย backend เอง (ไม่ได้ INSERT ปลอม)
// ยกเว้นบัญชีผู้ใช้ตั้งต้น 4 บัญชี ที่สร้างตรงในฐานข้อมูล (เพราะการสมัครปกติต้องยืนยัน OTP ทางอีเมล)
//
// ใช้:  API_BASE=http://localhost:5000 node smart-deal-backend/scripts/seeds/seed_demo_via_api.js
// ลบข้อมูลตัวอย่าง: node smart-deal-backend/scripts/seeds/seed_demo_via_api.js --clean
// บัญชีตัวอย่างทุกบัญชีใช้อีเมล @demo.smartdeal.test และรหัสผ่าน Demo1234
// ==========================================================
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { resolveDbConfig } = require('../../db/config');

const BASE = (process.env.API_BASE || 'http://localhost:5000') + '/api';
const DOMAIN = '@demo.smartdeal.test';
const PW = 'Demo1234';
const GAP = parseInt(process.env.DEMO_GAP_MS || '1500', 10);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const MOBILE = { 'User-Agent': 'okhttp/4.12.0 (Android 14; Samsung Galaxy A54)' };
const IPHONE = { 'User-Agent': 'SmartDeal/1.0 CFNetwork/1490 Darwin/23.2.0 (iPhone 15)' };
const WEB = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/131.0 Safari/537.36' };

const call = async (method, path, body, headers = {}) => {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch (e) { /* ignore */ }
  return { status: res.status, data };
};
const step = async (label, fn) => {
  const r = await fn();
  const ok = r && (r.status < 300 || r.expectFail);
  console.log(`${ok ? '✅' : '❌'} ${label}${r?.data?.message ? ` — ${r.data.message}` : ''}`);
  await sleep(GAP);
  return r;
};

(async () => {
  const cfg = resolveDbConfig();
  const db = await mysql.createConnection({ host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database, charset: 'utf8mb4', dateStrings: true });
  const q = async (sql, p) => (await db.query(sql, p))[0];

  if (process.argv.includes('--clean')) {
    const users = await q(`SELECT user_id FROM users WHERE email LIKE ?`, [`%${DOMAIN}`]);
    const ids = users.map(u => u.user_id);
    if (!ids.length) { console.log('ไม่มีข้อมูลตัวอย่าง'); process.exit(0); }
    const shops = (await q('SELECT shop_id FROM shops WHERE owner_id IN (?)', [ids])).map(s => s.shop_id);
    const riders = (await q('SELECT rider_id FROM riders WHERE user_id IN (?)', [ids])).map(r => r.rider_id);
    const orders = (await q('SELECT order_id FROM orders WHERE user_id IN (?)', [ids])).map(o => o.order_id);
    if (orders.length) {
      await q('DELETE FROM order_status_logs WHERE order_id IN (?)', [orders]);
      await q('DELETE FROM deliveries WHERE order_id IN (?)', [orders]);
      await q('DELETE FROM wallet_transactions WHERE order_id IN (?)', [orders]);
    }
    if (shops.length) { await q('DELETE FROM transactions WHERE shop_id IN (?)', [shops]); await q("DELETE FROM wallet_transactions WHERE user_type='shop' AND target_id IN (?)", [shops]); }
    if (riders.length) await q("DELETE FROM wallet_transactions WHERE user_type='rider' AND target_id IN (?)", [riders]);
    await q('DELETE FROM login_logs WHERE user_id IN (?) OR login_identifier LIKE ?', [ids, `%${DOMAIN}`]);
    await q('DELETE FROM admin_audit_logs WHERE (actor_type <> "admin" AND actor_id IN (?)) OR (entity_type = "user" AND entity_id IN (?)) OR (entity_type = "shop" AND entity_id IN (?)) OR (entity_type = "rider" AND entity_id IN (?))',
      [ids, ids.map(String), shops.length ? shops.map(String) : ['-'], riders.length ? riders.map(String) : ['-']]);
    await q('DELETE FROM users WHERE user_id IN (?)', [ids]); // CASCADE: orders, shops, products, riders, notifications, ...
    console.log(`🧹 ลบข้อมูลตัวอย่างแล้ว (${ids.length} บัญชี พร้อมออเดอร์/ร้าน/log ที่เกี่ยวข้อง)`);
    process.exit(0);
  }

  const exists = await q('SELECT COUNT(*) n FROM users WHERE email LIKE ?', [`%${DOMAIN}`]);
  if (exists[0].n > 0) { console.log('มีข้อมูลตัวอย่างอยู่แล้ว - รัน --clean ก่อนถ้าต้องการสร้างใหม่'); process.exit(0); }

  // ---------- บัญชีตั้งต้น ----------
  const hash = await bcrypt.hash(PW, 10);
  const mk = async (name, role, email, phone) => (await q('INSERT INTO users (email, phone, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, ?, "active")', [email + DOMAIN, phone, hash, name, role])).insertId;
  const somying = await mk('สมหญิง ใจดี', 'buyer', 'somying', '0861110001');
  const thanakorn = await mk('ธนากร รักเรียน', 'buyer', 'thanakorn', '0861110002');
  const padaeng = await mk('ป้าแดง ศรีสุข', 'buyer', 'padaeng', '0861110003');
  const heati = await mk('เฮียตี๋ แซ่ลิ้ม', 'buyer', 'heati', '0861110004');
  console.log('👤 สร้างบัญชีตั้งต้น 4 บัญชี (รหัสผ่าน Demo1234)');

  // ---------- แอดมินล็อกอิน ----------
  const adminLogin = await step('แอดมินล็อกอินเว็บแอดมิน', () => call('POST', '/admin/login', { email: process.env.ADMIN_DEFAULT_EMAIL || 'admin@smartdeal.com', password: process.env.ADMIN_DEFAULT_PASSWORD || 'admin1234' }, WEB));
  const ADMIN = { ...WEB, 'X-Admin-Id': String(adminLogin.data?.admin?.admin_id || ''), 'X-Admin-Name': encodeURIComponent(adminLogin.data?.admin?.full_name || 'ผู้ดูแลระบบ') };

  // ---------- สมัครเปิดร้าน ----------
  let r = await step('ป้าแดงสมัครเปิดร้าน "ข้าวมันไก่ป้าแดง"', () => call('POST', '/shops/register', { owner_id: padaeng, name: 'ข้าวมันไก่ป้าแดง', description: 'ข้าวมันไก่ต้ม-ทอด สูตรไหหลำ', category_id: 2, address: 'ตลาดน้อย ต.ขามเรียง มหาสารคาม', latitude: 16.2468, longitude: 103.2519, bank_name: 'กสิกรไทย', bank_account: '123-4-56789-0' }, MOBILE));
  const shopA = r.data?.shop_id;
  r = await step('เฮียตี๋สมัครเปิดร้าน "ชานมไข่มุกเฮียตี๋"', () => call('POST', '/shops/register', { owner_id: heati, name: 'ชานมไข่มุกเฮียตี๋', description: 'ชานม ชาเขียว โกโก้', category_id: 4, address: 'หน้ามหาวิทยาลัย มหาสารคาม', latitude: 16.2475, longitude: 103.2530, bank_name: 'ไทยพาณิชย์', bank_account: '987-6-54321-0' }, IPHONE));
  const shopB = r.data?.shop_id;
  await step('แอดมินอนุมัติร้านข้าวมันไก่ป้าแดง', () => call('PUT', `/admin/shops/${shopA}/approve`, {}, ADMIN));
  await step('แอดมินปฏิเสธร้านชานมไข่มุกเฮียตี๋ (รูปบัตรไม่ชัด)', () => call('PUT', `/admin/shops/${shopB}/reject`, { reason: 'รูปบัตรประชาชนไม่ชัด กรุณาอัปโหลดใหม่' }, ADMIN));
  await step('เฮียตี๋ส่งคำขอเปิดร้านใหม่อีกครั้ง', () => call('POST', '/shops/register', { owner_id: heati, name: 'ชานมไข่มุกเฮียตี๋', description: 'ชานม ชาเขียว โกโก้', category_id: 4, address: 'หน้ามหาวิทยาลัย มหาสารคาม', latitude: 16.2475, longitude: 103.2530, bank_name: 'ไทยพาณิชย์', bank_account: '987-6-54321-0' }, IPHONE));
  await step('แอดมินอนุมัติร้านชานมไข่มุกเฮียตี๋', () => call('PUT', `/admin/shops/${shopB}/approve`, {}, ADMIN));

  // ---------- สมัครไรเดอร์ ----------
  await step('สมศักดิ์สมัครเป็นไรเดอร์', () => call('POST', '/rider/register', { email: 'somsak' + DOMAIN, password: PW, phone: '0861110005', name: 'สมศักดิ์ ขับไว', real_name: 'สมศักดิ์ ขับไว', vehicle_type: 'มอเตอร์ไซค์', vehicle_plate: '1กข 2345 มหาสารคาม', license_number: 'DL-6600123' }, MOBILE));
  r = await step('สมศักดิ์ล็อกอินแอปไรเดอร์ (ยังรออนุมัติ)', async () => ({ ...(await call('POST', '/rider/login', { email: 'somsak' + DOMAIN, password: PW }, MOBILE)), expectFail: true }));
  const [riderRow] = await q('SELECT r.rider_id, r.user_id FROM riders r JOIN users u ON u.user_id = r.user_id WHERE u.email = ?', ['somsak' + DOMAIN]);
  const riderId = riderRow.rider_id;
  await step('แอดมินอนุมัติไรเดอร์สมศักดิ์', () => call('PUT', `/admin/riders/${riderId}/approve`, {}, ADMIN));

  // ---------- ล็อกอินทุก role ----------
  await step('สมหญิงล็อกอินผิดรหัส', async () => ({ ...(await call('POST', '/login', { identifier: 'somying' + DOMAIN, password: 'wrongpass' }, IPHONE)), expectFail: true }));
  await step('สมหญิงล็อกอินสำเร็จ', () => call('POST', '/login', { identifier: 'somying' + DOMAIN, password: PW }, IPHONE));
  await step('ธนากรล็อกอินด้วยเบอร์โทร', () => call('POST', '/login', { identifier: '0861110002', password: PW }, MOBILE));
  await step('ป้าแดงล็อกอิน (ร้านค้า)', () => call('POST', '/login', { identifier: 'padaeng' + DOMAIN, password: PW }, MOBILE));
  await step('เฮียตี๋ล็อกอิน (ร้านค้า)', () => call('POST', '/login', { identifier: 'heati' + DOMAIN, password: PW }, IPHONE));
  await step('สมศักดิ์ล็อกอินแอปไรเดอร์', () => call('POST', '/rider/login', { email: 'somsak' + DOMAIN, password: PW }, MOBILE));
  await step('สมศักดิ์เปิดรับงาน (Online)', () => call('PUT', `/rider/${riderId}/online-status`, { is_online: true }, MOBILE));

  // ---------- ร้านลงเมนู + แก้ราคา ----------
  const addP = (shop, p, h) => call('POST', `/shops/${shop}/products`, p, h);
  const pChicken = (await step('ป้าแดงเพิ่มเมนู ข้าวมันไก่ต้ม', () => addP(shopA, { name: 'ข้าวมันไก่ต้ม', category_id: 2, original_price: 60, discount_price: 45, stock_quantity: 20, expiry_text: 'หมดอายุ 20:00 วันนี้', description: 'ไก่ต้มนุ่ม น้ำจิ้มสูตรเด็ด' }, MOBILE))).data?.product_id;
  const pFried = (await step('ป้าแดงเพิ่มเมนู ข้าวมันไก่ทอด', () => addP(shopA, { name: 'ข้าวมันไก่ทอด', category_id: 2, original_price: 65, discount_price: 50, stock_quantity: 15, expiry_text: 'หมดอายุ 20:00 วันนี้' }, MOBILE))).data?.product_id;
  const pSoup = (await step('ป้าแดงเพิ่มเมนู ซุปฟัก', () => addP(shopA, { name: 'ซุปฟัก', category_id: 2, original_price: 20, discount_price: 15, stock_quantity: 10 }, MOBILE))).data?.product_id;
  const pTea = (await step('เฮียตี๋เพิ่มเมนู ชานมไข่มุก', () => addP(shopB, { name: 'ชานมไข่มุก', category_id: 4, original_price: 45, discount_price: 35, stock_quantity: 30 }, IPHONE))).data?.product_id;
  const pCocoa = (await step('เฮียตี๋เพิ่มเมนู โกโก้เย็น', () => addP(shopB, { name: 'โกโก้เย็น', category_id: 4, original_price: 40, discount_price: 32, stock_quantity: 25 }, IPHONE))).data?.product_id;
  await step('ป้าแดงจัดโปรลดราคาข้าวมันไก่ทอด 50 → 42 และเติมสต็อก', () => call('POST', `/shops/${shopA}/products/${pFried}`, { discount_price: 42, stock_quantity: 25 }, MOBILE));
  await step('ป้าแดงแก้เวลาเปิดร้าน', () => call('PUT', `/seller/settings/${shopA}`, { name: 'ข้าวมันไก่ป้าแดง', address: 'ตลาดน้อย ต.ขามเรียง มหาสารคาม', opening_hours: 'ทุกวัน 06:00 - 20:00', bank_name: 'กสิกรไทย', bank_account: '123-4-56789-0', latitude: 16.2468, longitude: 103.2519 }, MOBILE));

  // ---------- คูปอง ----------
  await call('GET', `/points/${somying}`, null, IPHONE);
  await step('สมหญิงใช้ 200 แต้มแลกคูปองส่วนลด 20 บาท', () => call('POST', '/points/redeem', { user_id: somying, cost: 200, code: 'SAVE20', title: 'ส่วนลด 20 บาท', type: 'discount', value: 20 }, IPHONE));
  const [coupon] = await q('SELECT id FROM user_coupons WHERE user_id = ? ORDER BY id DESC LIMIT 1', [somying]);

  // ---------- ออเดอร์ 1: ครบทุกสเต็ป ----------
  const createOrder = (body, h) => call('POST', '/orders', body, h);
  r = await step('สมหญิงสั่งข้าวมันไก่ต้ม x2 + ซุปฟัก x1 (ใช้คูปอง SAVE20)', () => createOrder({
    user_id: somying, shop_id: shopA, subtotal: 105, delivery_fee: 25, discount: 20, total_amount: 110, delivery_type: 'delivery', payment_method: 'promptpay',
    receiver_name: 'สมหญิง ใจดี', receiver_phone: '0861110001', shipping_address: 'หอพักสุขใจ ห้อง 305 ม.มหาสารคาม', latitude: 16.2490, longitude: 103.2550,
    note_for_rider: 'โทรหาเมื่อถึงหน้าหอ', coupon_id: coupon?.id, coupon_code: 'SAVE20',
    items: [{ product_id: pChicken, quantity: 2, price: 45 }, { product_id: pSoup, quantity: 1, price: 15 }] }, IPHONE));
  const o1 = r.data?.order_id;
  const qr1 = await step(`สมหญิงสร้าง QR ชำระเงินออเดอร์ #${o1}`, () => call('POST', '/payment/generate-qr', { order_id: o1, total_amount: 110 }, IPHONE));
  await step('ชำระเงินสำเร็จ', () => call('POST', '/payment/webhook', { charge_id: qr1.data?.charge_id, status: 'successful' }));
  await step('ป้าแดงกดรับออเดอร์ และเริ่มทำอาหาร', () => call('PUT', `/orders/${o1}/status`, { order_status: 'preparing', shop_id: shopA }, MOBILE));
  await step('ป้าแดงทำอาหารเสร็จ พร้อมส่ง', () => call('PUT', `/orders/${o1}/status`, { order_status: 'ready', shop_id: shopA }, MOBILE));
  await step('สมศักดิ์กดรับงาน', () => call('PUT', `/rider/deliveries/${o1}/status`, { rider_id: riderId, status: 'accepted' }, MOBILE));
  await step('สมศักดิ์ถึงร้าน รับอาหาร ถ่ายรูปยืนยัน', () => call('POST', `/rider/deliveries/${o1}/pickup`, { rider_id: riderId, shop_id: shopA, pickup_proof_image: 'data:image/png;base64,iVBORw0KGgo=', is_all_picked_up: true }, MOBILE));
  await step('สมศักดิ์ส่งถึงมือลูกค้า ถ่ายรูปยืนยัน', () => call('POST', `/rider/deliveries/${o1}/complete`, { rider_id: riderId, proof_image_base64: 'data:image/png;base64,iVBORw0KGgo=' }, MOBILE));
  await step('สมหญิงกดยืนยันรับสินค้า (ระบบโอนเงินให้ร้านและไรเดอร์)', () => call('PUT', `/orders/${o1}/complete`, null, IPHONE));
  await step('สมหญิงรีวิวร้าน 5 ดาว และให้คะแนนไรเดอร์', () => call('POST', '/reviews', { order_id: o1, user_id: somying, shop_id: shopA, rating: 5, comment: 'ไก่นุ่มมาก น้ำจิ้มอร่อย', rider_id: riderId, rider_rating: 5, rider_comment: 'มาเร็ว สุภาพ' }, IPHONE));

  // ---------- ออเดอร์ 2: ส่งถึงแล้ว รอลูกค้ายืนยัน ----------
  r = await step('ธนากรสั่งชานมไข่มุก x2 + โกโก้เย็น x1', () => createOrder({ user_id: thanakorn, shop_id: shopB, subtotal: 102, delivery_fee: 20, total_amount: 122, delivery_type: 'delivery', payment_method: 'promptpay',
    receiver_name: 'ธนากร รักเรียน', receiver_phone: '0861110002', shipping_address: 'คณะวิทยาการสารสนเทศ ตึก IT ชั้น 2', latitude: 16.2460, longitude: 103.2540,
    items: [{ product_id: pTea, quantity: 2, price: 35 }, { product_id: pCocoa, quantity: 1, price: 32 }] }, MOBILE));
  const o2 = r.data?.order_id;
  const qr2 = await step(`ธนากรสร้าง QR ชำระเงินออเดอร์ #${o2}`, () => call('POST', '/payment/generate-qr', { order_id: o2, total_amount: 122 }, MOBILE));
  await step('ชำระเงินสำเร็จ', () => call('POST', '/payment/webhook', { charge_id: qr2.data?.charge_id, status: 'successful' }));
  await step('เฮียตี๋กดรับออเดอร์', () => call('PUT', `/orders/${o2}/status`, { order_status: 'preparing', shop_id: shopB }, IPHONE));
  await step('เฮียตี๋ชงเสร็จ', () => call('PUT', `/orders/${o2}/status`, { order_status: 'ready', shop_id: shopB }, IPHONE));
  await step('สมศักดิ์กดรับงาน', () => call('PUT', `/rider/deliveries/${o2}/status`, { rider_id: riderId, status: 'accepted' }, MOBILE));
  await step('สมศักดิ์รับของจากร้าน', () => call('POST', `/rider/deliveries/${o2}/pickup`, { rider_id: riderId, shop_id: shopB, pickup_proof_image: 'data:image/png;base64,iVBORw0KGgo=', is_all_picked_up: true }, MOBILE));
  await step('สมศักดิ์ส่งถึงลูกค้าแล้ว (รอลูกค้ากดยืนยัน)', () => call('POST', `/rider/deliveries/${o2}/complete`, { rider_id: riderId, proof_image_base64: 'data:image/png;base64,iVBORw0KGgo=' }, MOBILE));

  // ---------- ออเดอร์ 3: ร้านยกเลิก ----------
  r = await step('ธนากรสั่งข้าวมันไก่ทอด x3', () => createOrder({ user_id: thanakorn, shop_id: shopA, subtotal: 126, delivery_fee: 25, total_amount: 151, delivery_type: 'delivery', payment_method: 'promptpay',
    receiver_name: 'ธนากร รักเรียน', receiver_phone: '0861110002', shipping_address: 'คณะวิทยาการสารสนเทศ ตึก IT ชั้น 2', items: [{ product_id: pFried, quantity: 3, price: 42 }] }, MOBILE));
  const o3 = r.data?.order_id;
  await step('ป้าแดงยกเลิกออเดอร์ (ไก่ทอดหมด) ระบบคืนสต็อก', () => call('PUT', `/orders/${o3}/status`, { order_status: 'cancelled', shop_id: shopA, reason: 'ไก่ทอดหมดแล้ว ขออภัยค่ะ' }, MOBILE));

  // ---------- ออเดอร์ 4: กำลังทำอาหาร ----------
  r = await step('สมหญิงสั่งข้าวมันไก่ทอด x1 (กำลังทำ)', () => createOrder({ user_id: somying, shop_id: shopA, subtotal: 42, delivery_fee: 25, total_amount: 67, delivery_type: 'delivery', payment_method: 'promptpay',
    receiver_name: 'สมหญิง ใจดี', receiver_phone: '0861110001', shipping_address: 'หอพักสุขใจ ห้อง 305 ม.มหาสารคาม', items: [{ product_id: pFried, quantity: 1, price: 42 }] }, IPHONE));
  const o4 = r.data?.order_id;
  const qr4 = await step(`สมหญิงสร้าง QR ชำระเงินออเดอร์ #${o4}`, () => call('POST', '/payment/generate-qr', { order_id: o4, total_amount: 67 }, IPHONE));
  await step('ชำระเงินสำเร็จ', () => call('POST', '/payment/webhook', { charge_id: qr4.data?.charge_id, status: 'successful' }));
  await step('ป้าแดงกดรับออเดอร์', () => call('PUT', `/orders/${o4}/status`, { order_status: 'preparing', shop_id: shopA }, MOBILE));

  // ---------- การเงิน ----------
  await step('ป้าแดงขอถอนเงิน 50 บาท', () => call('POST', '/seller/wallet/withdraw', { shop_id: shopA, amount: 50 }, MOBILE));
  const [w1] = await q('SELECT id FROM withdrawals WHERE shop_id = ? ORDER BY id DESC LIMIT 1', [shopA]);
  await step('แอดมินอนุมัติและโอนเงิน 50 บาท', () => call('POST', `/admin/withdrawals/${w1.id}/approve`, {}, ADMIN));
  await step('ป้าแดงขอถอนเงินอีก 20 บาท', () => call('POST', '/seller/wallet/withdraw', { shop_id: shopA, amount: 20 }, MOBILE));
  const [w2] = await q('SELECT id FROM withdrawals WHERE shop_id = ? ORDER BY id DESC LIMIT 1', [shopA]);
  await step('แอดมินปฏิเสธ (ยอดต่ำกว่าขั้นต่ำ) ระบบคืนเงินเข้ากระเป๋าร้าน', () => call('POST', `/admin/withdrawals/${w2.id}/reject`, { reason: 'ยอดถอนต่ำกว่าขั้นต่ำ 50 บาท' }, ADMIN));
  await step('สมศักดิ์ขอถอนค่ารอบ 20 บาท', () => call('POST', '/rider/wallet/withdraw', { rider_id: riderId, amount: 20 }, MOBILE));

  // ---------- อื่นๆ ----------
  await step('ธนากรแจ้งเรื่องร้องเรียน', () => call('POST', '/complaints', { user_id: thanakorn, order_id: o3, subject: 'ร้านยกเลิกออเดอร์', message: 'ร้านยกเลิกหลังสั่ง อยากได้เงินคืนครับ' }, MOBILE));
  const [cp] = await q('SELECT id FROM complaints WHERE user_id = ? ORDER BY id DESC LIMIT 1', [thanakorn]);
  await step('แอดมินรับเรื่องร้องเรียน (กำลังดำเนินการ)', () => call('PUT', `/admin/complaints/${cp.id}/status`, { status: 'in_progress' }, ADMIN));
  await step('เฮียตี๋ปิดร้านชั่วคราว', () => call('PUT', `/seller/toggle-status/${shopB}`, { is_open: false }, IPHONE));
  await step('สมหญิงปิดการรับข่าวโปรโมชันในตั้งค่าแอป', () => call('PUT', `/users/${somying}/app-settings`, { promoEnabled: false }, IPHONE));
  const notifs = await q('SELECT notification_id FROM notifications WHERE user_id = ? ORDER BY notification_id LIMIT 3', [somying]);
  for (const n of notifs) await call('PUT', `/notifications/${n.notification_id}/read`, null, IPHONE);
  console.log(`✅ สมหญิงเปิดอ่านแจ้งเตือน ${notifs.length} รายการ`);
  await step('สมศักดิ์ปิดรับงาน (Offline)', () => call('PUT', `/rider/${riderId}/online-status`, { is_online: false }, MOBILE));

  console.log(`\n🎉 เสร็จแล้ว: ออเดอร์ #${o1} (ครบทุกสเต็ป), #${o2} (รอลูกค้ายืนยัน), #${o3} (ร้านยกเลิก), #${o4} (กำลังทำอาหาร)`);
  await db.end();
})().catch(e => { console.error('❌', e); process.exit(1); });
