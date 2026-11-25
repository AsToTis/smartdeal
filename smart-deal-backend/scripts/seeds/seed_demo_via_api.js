// ==========================================================
// Smart Deal - ข้อมูลตัวอย่างเสมือนใช้งานจริง สร้างผ่าน API จริงทุกขั้นตอน
//
//   API_BASE=http://localhost:5000 node smart-deal-backend/scripts/seeds/seed_demo_via_api.js --reset-all
//     --reset-all : ล้างข้อมูลธุรกิจเดิมทั้งหมดก่อน (เก็บ categories, system_settings, banners, บัญชีแอดมิน)
//
// ทุก log (order_status_logs, login_logs, admin_audit_logs, notifications, transactions, ...) เขียนโดย backend เอง
// ข้อยกเว้นเดียว: บัญชีลูกค้า/เจ้าของร้านถูกสร้างตรงในฐานข้อมูล เพราะการสมัครปกติต้องยืนยัน OTP ทางอีเมลจริง
// รหัสผ่านทุกบัญชีตัวอย่าง: Demo1234   อีเมล: <ชื่อ>@demo.smartdeal.test
// ==========================================================
const zlib = require('zlib');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { resolveDbConfig } = require('../../db/config');

const BASE = (process.env.API_BASE || 'http://localhost:5000') + '/api';
const DOMAIN = '@demo.smartdeal.test';
const PW = 'Demo1234';
const GAP = parseInt(process.env.DEMO_GAP_MS || '700', 10);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const endOfDay = () => { const d = new Date(); d.setHours(20, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); return d.toISOString(); };

const DEV = {
  android: { 'User-Agent': 'okhttp/4.12.0 (Android 14; Samsung Galaxy A54)' },
  iphone: { 'User-Agent': 'SmartDeal/1.0 CFNetwork/1490 Darwin/23.2.0 (iPhone 15)' },
  oppo: { 'User-Agent': 'okhttp/4.12.0 (Android 13; OPPO Reno8)' },
  web: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0 Safari/537.36' },
};

// ---------- รูป PNG สีพื้น (ไม่ใช้รูปเอกสารจริงของผู้ใช้) ----------
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
const makePng = (hex, size = 96) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(size).fill([r, g, b]).flat())]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(size).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
};
const pngBlob = (hex) => new Blob([makePng(hex)], { type: 'image/png' });
const pngDataUri = (hex) => `data:image/png;base64,${makePng(hex, 32).toString('base64')}`;

// ---------- HTTP ----------
let failures = 0;
const call = async (method, path, body, headers = {}) => {
  const isForm = body instanceof FormData;
  const res = await fetch(BASE + path, { method, headers: isForm ? headers : { 'Content-Type': 'application/json', ...headers }, body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  let data = null; try { data = await res.json(); } catch (e) { /* ignore */ }
  return { status: res.status, data };
};
const step = async (label, fn, { expectFail = false } = {}) => {
  const r = await fn();
  const ok = expectFail ? r.status >= 400 : r.status < 300 && r.data?.success !== false;
  if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${label}${r?.data?.message ? ` — ${r.data.message}` : ''}`);
  await sleep(GAP);
  return r;
};
const form = (fields, files = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) f.append(k, String(v));
  for (const [k, [hex, name]] of Object.entries(files)) f.append(k, pngBlob(hex), name);
  return f;
};

(async () => {
  const cfg = resolveDbConfig();
  const db = await mysql.createConnection({ host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database, charset: 'utf8mb4', dateStrings: true });
  const q = async (sql, p) => (await db.query(sql, p))[0];

  // ==================== ล้างข้อมูลเดิม ====================
  if (process.argv.includes('--reset-all')) {
    const KEEP = new Set(['categories', 'system_settings', 'banners', 'schema_migrations', 'users']);
    const tables = (await q('SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = "BASE TABLE"', [cfg.database])).map(r => r.t);
    await q('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of tables) if (!KEEP.has(t)) await q(`TRUNCATE TABLE \`${t}\``);
    await q("DELETE FROM users WHERE role <> 'admin'");
    await q('SET FOREIGN_KEY_CHECKS = 1');
    console.log(`🧹 ล้างข้อมูลเดิมแล้ว (${tables.length - KEEP.size + 1} ตาราง) เก็บไว้: หมวดหมู่, ตั้งค่าระบบ, แบนเนอร์, บัญชีแอดมิน\n`);
  } else if ((await q('SELECT COUNT(*) n FROM users WHERE email LIKE ?', [`%${DOMAIN}`]))[0].n > 0) {
    console.log('มีข้อมูลตัวอย่างอยู่แล้ว - ใช้ --reset-all เพื่อสร้างใหม่'); process.exit(0);
  }

  // ==================== แอดมิน ====================
  const adminLogin = await step('แอดมินล็อกอินเว็บแอดมิน', () => call('POST', '/admin/login', { email: process.env.ADMIN_DEFAULT_EMAIL || 'admin@smartdeal.com', password: process.env.ADMIN_DEFAULT_PASSWORD || 'admin1234' }, DEV.web));
  const ADMIN_ID = adminLogin.data?.admin?.admin_id;
  const A = { ...DEV.web, 'X-Admin-Id': String(adminLogin.data?.admin?.admin_id || ''), 'X-Admin-Name': encodeURIComponent(adminLogin.data?.admin?.full_name || '') };

  if (ADMIN_ID) await step('แอดมินอัปโหลดรูปโปรไฟล์', () => call('POST', `/users/${ADMIN_ID}/avatar`, form({}, { avatar: ['#1e293b', 'admin.png'] }), A));

  // ==================== บัญชีผู้ใช้ ====================
  const hash = await bcrypt.hash(PW, 10);
  const people = {};
  const mkUser = async (key, name, phone, dev, color) => {
    const id = (await q('INSERT INTO users (email, phone, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, "buyer", "active")', [key + DOMAIN, phone, hash, name])).insertId;
    people[key] = { key, id, name, email: key + DOMAIN, phone, dev: DEV[dev], color };
    return people[key];
  };
  for (const [k, n, p, d, c] of [
    ['somying', 'สมหญิง ใจดี', '0861110001', 'iphone', '#f472b6'], ['thanakorn', 'ธนากร รักเรียน', '0861110002', 'android', '#60a5fa'],
    ['manee', 'มานี มีสุข', '0861110003', 'oppo', '#fbbf24'], ['piti', 'ปิติ ยินดี', '0861110004', 'android', '#34d399'],
    ['chujai', 'ชูใจ ใฝ่ดี', '0861110005', 'iphone', '#a78bfa'],
    ['padaeng', 'ป้าแดง ศรีสุข', '0862220001', 'android', '#ef4444'], ['heati', 'เฮียตี๋ แซ่ลิ้ม', '0862220002', 'iphone', '#10b981'],
    ['ann', 'แอน วงศ์ขนม', '0862220003', 'iphone', '#f59e0b'], ['lungchai', 'ลุงชัย สวนผลไม้', '0862220004', 'oppo', '#84cc16'],
    ['fon', 'ฝน หวานใจ', '0862220005', 'android', '#ec4899'], ['somtam', 'แซ่บ นัวจริง', '0862220006', 'android', '#f97316'],
  ]) await mkUser(k, n, p, d, c);
  console.log(`👤 สร้างบัญชีตั้งต้น ${Object.keys(people).length} บัญชี (รหัสผ่าน ${PW})`);

  // ล็อกอิน + โปรไฟล์ + ที่อยู่ ของลูกค้า
  const buyers = ['somying', 'thanakorn', 'manee', 'piti', 'chujai'];
  const ADDR = {
    somying: ['หอพักสุขใจ ห้อง 305 ม.มหาสารคาม', 16.2490, 103.2550], thanakorn: ['คณะวิทยาการสารสนเทศ ตึก IT ชั้น 2', 16.2460, 103.2540],
    manee: ['หมู่บ้านพฤกษา ซอย 3 บ้านเลขที่ 45', 16.2510, 103.2600], piti: ['คอนโด The Base ห้อง 1208', 16.2440, 103.2580], chujai: ['ร้านถ่ายเอกสาร หน้าประตู 2', 16.2475, 103.2525],
  };
  await step('สมหญิงล็อกอินผิดรหัส', () => call('POST', '/login', { identifier: people.somying.email, password: 'wrongpass' }, people.somying.dev), { expectFail: true });
  for (const k of Object.keys(people)) {
    const u = people[k];
    await step(`${u.name} ล็อกอินแอป`, () => call('POST', '/login', { identifier: k === 'thanakorn' ? u.phone : u.email, password: PW }, u.dev));
    await step(`${u.name} อัปโหลดรูปโปรไฟล์`, () => call('POST', `/users/${u.id}/avatar`, form({}, { avatar: [u.color, `${k}.png`] }), u.dev));
  }
  for (const k of buyers) {
    const u = people[k]; const [addr, lat, lng] = ADDR[k];
    await step(`${u.name} บันทึกที่อยู่จัดส่ง`, () => call('POST', `/users/${u.id}/address`, { title: 'บ้าน', address_detail: addr, latitude: lat, longitude: lng, receiver_name: u.name, receiver_phone: u.phone, note_for_rider: 'โทรก่อนถึง 5 นาที' }, u.dev));
    await step(`${u.name} ตั้งค่าแอป`, () => call('PUT', `/users/${u.id}/app-settings`, { pushEnabled: true, promoEnabled: k !== 'piti', locationEnabled: true, darkMode: k === 'manee' }, u.dev));
  }
  await step('มานีแก้เบอร์โทรในโปรไฟล์', () => call('PUT', `/users/${people.manee.id}/profile`, { full_name: 'มานี มีสุข', phone: '0861119999', email: people.manee.email }, people.manee.dev));
  people.manee.phone = '0861119999';
  await step('ปิติเปลี่ยนรหัสผ่าน', () => call('PUT', `/users/${people.piti.id}/change-password`, { old_password: PW, new_password: 'Demo5678' }, people.piti.dev));

  // ==================== ร้านค้า ====================
  const SHOPS = [
    { key: 'padaeng', name: 'ข้าวมันไก่ป้าแดง', cat: 2, desc: 'ข้าวมันไก่ต้ม-ทอด สูตรไหหลำ', addr: 'ตลาดน้อย ต.ขามเรียง มหาสารคาม', lat: 16.2468, lng: 103.2519, bank: ['กสิกรไทย', '123-4-56789-0'], hours: 'ทุกวัน 06:00 - 14:00', color: '#dc2626',
      menu: [['ข้าวมันไก่ต้ม', 60, 45, 30], ['ข้าวมันไก่ทอด', 65, 50, 25], ['ซุปฟัก', 20, 15, 20]] },
    { key: 'heati', name: 'ชานมไข่มุกเฮียตี๋', cat: 4, desc: 'ชานม ชาเขียว โกโก้', addr: 'หน้ามหาวิทยาลัย มหาสารคาม', lat: 16.2475, lng: 103.2530, bank: ['ไทยพาณิชย์', '987-6-54321-0'], hours: 'ทุกวัน 10:00 - 21:00', color: '#059669',
      menu: [['ชานมไข่มุก', 45, 35, 40], ['โกโก้เย็น', 40, 32, 30], ['ชาเขียวมัทฉะ', 50, 40, 25]] },
    { key: 'ann', name: 'แอนเบเกอรี่', cat: 1, desc: 'ขนมปังอบสดใหม่ทุกเช้า ลดราคาช่วงเย็น', addr: 'ถนนนครสวรรค์ มหาสารคาม', lat: 16.1840, lng: 103.3010, bank: ['กรุงเทพ', '111-2-33333-4'], hours: 'ทุกวัน 07:00 - 19:00', color: '#d97706',
      menu: [['ครัวซองต์เนยสด', 55, 35, 20], ['ขนมปังโฮลวีต', 45, 30, 15], ['บราวนี่ช็อกโกแลต', 40, 25, 20]] },
    { key: 'lungchai', name: 'ผลไม้สดลุงชัย', cat: 3, desc: 'ผลไม้ตามฤดูกาลจากสวน', addr: 'ตลาดสดเทศบาล มหาสารคาม', lat: 16.1860, lng: 103.2990, bank: ['กรุงไทย', '222-3-44444-5'], hours: 'จันทร์-เสาร์ 05:00 - 12:00', color: '#65a30d',
      menu: [['มะม่วงน้ำดอกไม้ (กล่อง)', 80, 50, 15], ['ฝรั่งกิมจู (ถุง)', 40, 25, 20]] },
    { key: 'fon', name: 'ขนมหวานบ้านฝน', cat: 5, desc: 'ขนมไทยโบราณ', addr: 'ซอยวัดมหาชัย มหาสารคาม', lat: 16.1820, lng: 103.3050, bank: ['ออมสิน', '333-4-55555-6'], hours: 'ทุกวัน 12:00 - 20:00', color: '#db2777',
      menu: [['บัวลอยไข่หวาน', 35, 25, 20], ['ทับทิมกรอบ', 30, 20, 20]] },
  ];
  const shops = {};
  for (const s of SHOPS) {
    const o = people[s.key];
    const r = await step(`${o.name} สมัครเปิดร้าน "${s.name}"`, () => call('POST', '/shops/register',
      form({ owner_id: o.id, name: s.name, description: s.desc, category_id: s.cat, address: s.addr, latitude: s.lat, longitude: s.lng, bank_name: s.bank[0], bank_account: s.bank[1] },
        { id_card_image: ['#e2e8f0', 'idcard.png'], bookbank_image: ['#cbd5e1', 'bookbank.png'] }), o.dev));
    shops[s.key] = { ...s, id: r.data?.shop_id, owner: o };
  }
  await step('แซ่บสมัครเปิดร้าน "ส้มตำแซ่บนัว" (รอตรวจสอบ)', () => call('POST', '/shops/register',
    form({ owner_id: people.somtam.id, name: 'ส้มตำแซ่บนัว', description: 'ส้มตำ ไก่ย่าง ลาบ', category_id: 2, address: 'ถนนริมคลองสมถวิล มหาสารคาม', latitude: 16.1880, longitude: 103.2960, bank_name: 'ธ.ก.ส.', bank_account: '444-5-66666-7' },
      { id_card_image: ['#e2e8f0', 'idcard.png'], bookbank_image: ['#cbd5e1', 'bookbank.png'] }), people.somtam.dev));
  await step('แอดมินปฏิเสธร้านขนมหวานบ้านฝน (รูปสมุดบัญชีไม่ชัด)', () => call('PUT', `/admin/shops/${shops.fon.id}/reject`, { reason: 'รูปสมุดบัญชีไม่ชัด กรุณาอัปโหลดใหม่' }, A));
  await step('ฝนส่งคำขอเปิดร้านใหม่พร้อมรูปที่ชัดขึ้น', () => call('POST', '/shops/register',
    form({ owner_id: people.fon.id, name: 'ขนมหวานบ้านฝน', description: 'ขนมไทยโบราณ', category_id: 5, address: shops.fon.addr, latitude: shops.fon.lat, longitude: shops.fon.lng, bank_name: 'ออมสิน', bank_account: '333-4-55555-6' },
      { id_card_image: ['#e2e8f0', 'idcard.png'], bookbank_image: ['#94a3b8', 'bookbank2.png'] }), people.fon.dev));
  for (const s of Object.values(shops)) {
    await step(`แอดมินอนุมัติร้าน ${s.name}`, () => call('PUT', `/admin/shops/${s.id}/approve`, {}, A));
  }
  for (const s of Object.values(shops)) {
    await step(`${s.name} อัปโหลดรูปหน้าร้าน`, () => call('POST', `/seller/settings/${s.id}/image`, form({}, { image: [s.color, 'shop.png'] }), s.owner.dev));
    await step(`${s.name} ตั้งเวลาเปิด-ปิดร้าน`, () => call('PUT', `/seller/settings/${s.id}`, { name: s.name, address: s.addr, opening_hours: s.hours, bank_name: s.bank[0], bank_account: s.bank[1], latitude: s.lat, longitude: s.lng }, s.owner.dev));
    s.products = {};
    for (const [n, op, dp, stock] of s.menu) {
      const r = await step(`${s.name} ลงเมนู ${n} (${op} → ${dp} บาท)`, () => call('POST', `/shops/${s.id}/products`,
        { name: n, category_id: s.cat, original_price: op, discount_price: dp, stock_quantity: stock, expiry_text: 'ขายวันนี้ก่อนร้านปิด', expiry_time: endOfDay(), deal_end_time: endOfDay(), description: `${n} จากร้าน ${s.name}`, image_url: pngDataUri(s.color) }, s.owner.dev));
      s.products[n] = { id: r.data?.product_id, price: dp };
    }
  }
  await step('ป้าแดงจัดโปรข้าวมันไก่ทอด 50 → 42 บาท และเติมสต็อก', () => call('POST', `/shops/${shops.padaeng.id}/products/${shops.padaeng.products['ข้าวมันไก่ทอด'].id}`, { discount_price: 42, stock_quantity: 40 }, shops.padaeng.owner.dev));
  shops.padaeng.products['ข้าวมันไก่ทอด'].price = 42;
  await step('แอนเบเกอรี่ปรับราคาบราวนี่ 25 → 22 บาท (โปรช่วงเย็น)', () => call('POST', `/shops/${shops.ann.id}/products/${shops.ann.products['บราวนี่ช็อกโกแลต'].id}`, { discount_price: 22 }, shops.ann.owner.dev));
  shops.ann.products['บราวนี่ช็อกโกแลต'].price = 22;

  // ==================== ไรเดอร์ ====================
  const RIDERS = [
    ['somsak', 'สมศักดิ์ ขับไว', '0863330001', 'มอเตอร์ไซค์', '1กข 2345 มหาสารคาม', 'DL-6600123', 'android'],
    ['weera', 'วีระ เร็วจี๋', '0863330002', 'มอเตอร์ไซค์', '2คง 7788 มหาสารคาม', 'DL-6600456', 'oppo'],
    ['prayut', 'ประยุทธ มั่นคง', '0863330003', 'รถยนต์', 'กท 5566 มหาสารคาม', 'DL-6600789', 'iphone'],
    ['sompong', 'สมปอง ไม่พร้อม', '0863330004', 'จักรยาน', '-', '-', 'android'],
  ];
  const riders = {};
  for (const [k, n, ph, vt, plate, lic, d] of RIDERS) {
    await step(`${n} สมัครเป็นไรเดอร์`, () => call('POST', '/rider/register',
      form({ email: k + DOMAIN, password: PW, phone: ph, name: n, real_name: n, vehicle_type: vt, vehicle_plate: plate, license_number: lic },
        { id_card_image: ['#e2e8f0', 'id.png'], license_image: ['#fde68a', 'license.png'], vehicle_doc_image: ['#bfdbfe', 'vehicle.png'] }), DEV[d]));
    const [row] = await q('SELECT r.rider_id, r.user_id FROM riders r JOIN users u ON u.user_id = r.user_id WHERE u.email = ?', [k + DOMAIN]);
    riders[k] = { id: row.rider_id, userId: row.user_id, name: n, email: k + DOMAIN, dev: DEV[d] };
  }
  await step('สมศักดิ์ล็อกอินแอปไรเดอร์ก่อนได้รับอนุมัติ', () => call('POST', '/rider/login', { email: riders.somsak.email, password: PW }, riders.somsak.dev), { expectFail: true });
  for (const k of ['somsak', 'weera', 'prayut']) await step(`แอดมินอนุมัติไรเดอร์ ${riders[k].name}`, () => call('PUT', `/admin/riders/${riders[k].id}/approve`, {}, A));
  await step('แอดมินปฏิเสธไรเดอร์สมปอง (ไม่มีใบขับขี่)', () => call('PUT', `/admin/riders/${riders.sompong.id}/reject`, { reason: 'ไม่มีใบอนุญาตขับขี่และทะเบียนรถ' }, A));
  await step('สมปองล็อกอินแอปไรเดอร์ (ถูกปฏิเสธ)', () => call('POST', '/rider/login', { email: riders.sompong.email, password: PW }, riders.sompong.dev), { expectFail: true });
  for (const k of ['somsak', 'weera', 'prayut']) {
    await step(`${riders[k].name} ล็อกอินแอปไรเดอร์`, () => call('POST', '/rider/login', { email: riders[k].email, password: PW }, riders[k].dev));
    await step(`${riders[k].name} อัปโหลดรูปโปรไฟล์`, () => call('POST', `/users/${riders[k].userId}/avatar`, form({}, { avatar: ['#0ea5e9', `${k}.png`] }), riders[k].dev));
    await step(`${riders[k].name} เปิดรับงาน`, () => call('PUT', `/rider/${riders[k].id}/online-status`, { is_online: true }, riders[k].dev));
  }
  for (const k of ['sompong']) await step(`${riders[k].name} อัปโหลดรูปโปรไฟล์`, () => call('POST', `/users/${riders[k].userId}/avatar`, form({}, { avatar: ['#94a3b8', `${k}.png`] }), riders[k].dev));

  // ==================== คูปอง ====================
  for (const k of ['somying', 'manee']) {
    await call('GET', `/points/${people[k].id}`, null, people[k].dev);
    await step(`${people[k].name} ใช้ 200 แต้มแลกคูปองส่วนลด 20 บาท`, () => call('POST', '/points/redeem', { user_id: people[k].id, cost: 200, code: 'SAVE20', title: 'ส่วนลด 20 บาท', type: 'discount', value: 20 }, people[k].dev));
  }

  // ==================== ค้นหา + ตะกร้า ====================
  const search = (k, kw) => step(`${people[k].name} ค้นหา "${kw}"`, () => call('GET', `/search?keyword=${encodeURIComponent(kw)}&user_id=${people[k].id}`, null, people[k].dev));
  await search('somying', 'ข้าวมันไก่'); await search('thanakorn', 'ชานม'); await search('manee', 'ครัวซองต์');
  await search('piti', 'มะม่วง'); await search('chujai', 'บัวลอย'); await search('thanakorn', 'พิซซ่า');
  const cartPut = (k, items, label) => step(`${people[k].name} ${label}`, () => call('PUT', `/cart/${people[k].id}`, { items: items.map(([sk, menu, qty]) => ({ product_id: shops[sk].products[menu].id, quantity: qty })) }, people[k].dev));
  await cartPut('somying', [['padaeng', 'ข้าวมันไก่ต้ม', 1]], 'หยิบข้าวมันไก่ต้มใส่ตะกร้า');
  await cartPut('somying', [['padaeng', 'ข้าวมันไก่ต้ม', 2], ['padaeng', 'ซุปฟัก', 1], ['heati', 'โกโก้เย็น', 1]], 'เพิ่มเป็น 2 จาน + ซุปฟัก + โกโก้เย็น');
  await cartPut('somying', [['padaeng', 'ข้าวมันไก่ต้ม', 2], ['padaeng', 'ซุปฟัก', 1]], 'เอาโกโก้เย็นออกจากตะกร้า');
  await cartPut('thanakorn', [['ann', 'บราวนี่ช็อกโกแลต', 2], ['fon', 'บัวลอยไข่หวาน', 1]], 'หยิบบราวนี่และบัวลอยใส่ตะกร้า (ยังไม่สั่ง)');
  await cartPut('chujai', [['heati', 'ชาเขียวมัทฉะ', 1]], 'หยิบชาเขียวใส่ตะกร้า (ยังไม่สั่ง)');

  // ==================== ออเดอร์ ====================
  const made = [];
  const order = async (buyerKey, lines, opts = {}) => {
    const b = people[buyerKey]; const [addr, lat, lng] = ADDR[buyerKey];
    const items = lines.map(([shopKey, menu, qty]) => ({ product_id: shops[shopKey].products[menu].id, quantity: qty, price: shops[shopKey].products[menu].price, shop_id: shops[shopKey].id }));
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const fee = opts.fee ?? 25; const discount = opts.coupon ? 20 : 0;
    let couponId = null;
    if (opts.coupon) { const [c] = await q('SELECT id FROM user_coupons WHERE user_id = ? AND is_used = 0 ORDER BY id LIMIT 1', [b.id]); couponId = c?.id || null; }
    const r = await step(`${b.name} สั่ง ${lines.map(l => `${l[1]} x${l[2]}`).join(' + ')}${opts.coupon ? ' (ใช้คูปอง)' : ''}`, () => call('POST', '/orders', {
      user_id: b.id, shop_id: shops[lines[0][0]].id, subtotal, delivery_fee: fee, discount, total_amount: subtotal + fee - discount, delivery_type: 'delivery', payment_method: 'promptpay',
      receiver_name: b.name, receiver_phone: b.phone, shipping_address: addr, latitude: lat, longitude: lng, note_for_rider: opts.note || 'โทรก่อนถึง 5 นาที',
      coupon_id: couponId, coupon_code: opts.coupon ? 'SAVE20' : null, items }, b.dev));
    const o = { id: r.data?.order_id, b, shopKeys: [...new Set(lines.map(l => l[0]))], total: subtotal + fee - discount };
    made.push(o);
    return o;
  };
  const pay = async (o) => {
    const qr = await step(`${o.b.name} สแกน QR จ่ายเงินออเดอร์ #${o.id}`, () => call('POST', '/payment/generate-qr', { order_id: o.id, total_amount: o.total }, o.b.dev));
    await step(`ระบบรับเงินออเดอร์ #${o.id} สำเร็จ`, () => call('POST', '/payment/webhook', { charge_id: qr.data?.charge_id, status: 'successful' }));
  };
  const shopDo = async (o, status, extra = {}) => { for (const k of o.shopKeys) await step(`${shops[k].name} ${status === 'preparing' ? 'กดรับออเดอร์' : status === 'ready' ? 'เตรียมเสร็จ' : 'ยกเลิก'} #${o.id}`, () => call('PUT', `/orders/${o.id}/status`, { order_status: status, shop_id: shops[k].id, ...extra }, shops[k].owner.dev)); };
  const gps = (rk, lat, lng) => call('PUT', `/riders/${riders[rk].id}/location`, { lat, lng, speed: 6 + Math.random() * 6, accuracy: 5 + Math.random() * 10 }, riders[rk].dev);
  const riderAccept = async (o, rk) => { await gps(rk, 16.2455, 103.2500); return step(`${riders[rk].name} รับงาน #${o.id}`, () => call('PUT', `/rider/deliveries/${o.id}/status`, { rider_id: riders[rk].id, status: 'accepted' }, riders[rk].dev)); };
  const riderPickup = async (o, rk) => { for (const [i, k] of o.shopKeys.entries()) { await gps(rk, shops[k].lat, shops[k].lng); await step(`${riders[rk].name} รับของจาก ${shops[k].name} #${o.id}`, () => call('POST', `/rider/deliveries/${o.id}/pickup`, { rider_id: riders[rk].id, shop_id: shops[k].id, pickup_proof_image: pngDataUri('#22c55e'), is_all_picked_up: i === o.shopKeys.length - 1 }, riders[rk].dev)); } };
  const riderDeliver = async (o, rk) => { const [, la, ln] = ADDR[o.b.key]; await gps(rk, la + 0.0001, ln + 0.0001); return step(`${riders[rk].name} ส่งถึงลูกค้า #${o.id}`, () => call('POST', `/rider/deliveries/${o.id}/complete`, { rider_id: riders[rk].id, proof_image_base64: pngDataUri('#3b82f6') }, riders[rk].dev)); };
  const confirm = (o) => step(`${o.b.name} กดยืนยันรับสินค้า #${o.id}`, () => call('PUT', `/orders/${o.id}/complete`, null, o.b.dev));
  const review = async (o, rk, stars, text, rtext) => { const up = await call('POST', '/reviews/upload', form({}, { image: ['#fcd34d', 'review.png'] }), o.b.dev); return step(`${o.b.name} รีวิว ${stars} ดาวพร้อมรูป #${o.id}`, () => call('POST', '/reviews', { order_id: o.id, user_id: o.b.id, shop_id: shops[o.shopKeys[0]].id, rating: stars, comment: text, image_url: up.data?.image_url, rider_id: riders[rk].id, rider_rating: Math.min(5, stars + 1), rider_comment: rtext }, o.b.dev)); };
  const full = async (o, rk, rv) => { await pay(o); await shopDo(o, 'preparing'); await shopDo(o, 'ready'); await riderAccept(o, rk); await riderPickup(o, rk); await riderDeliver(o, rk); await confirm(o); if (rv) await review(o, rk, ...rv); };

  // 1) ส่งสำเร็จครบทุกสเต็ป
  await full(await order('somying', [['padaeng', 'ข้าวมันไก่ต้ม', 2], ['padaeng', 'ซุปฟัก', 1]], { coupon: true }), 'somsak', [5, 'ไก่นุ่มมาก น้ำจิ้มอร่อย', 'มาเร็ว สุภาพ']);
  await full(await order('thanakorn', [['heati', 'ชานมไข่มุก', 2], ['heati', 'โกโก้เย็น', 1]], { fee: 20 }), 'weera', [4, 'หวานไปนิด แต่ไข่มุกนุ่ม', 'ส่งไว']);
  await full(await order('manee', [['ann', 'ครัวซองต์เนยสด', 3], ['ann', 'บราวนี่ช็อกโกแลต', 2]], { coupon: true }), 'prayut', [5, 'ครัวซองต์กรอบ หอมเนย', 'ห่อมาดีมาก']);
  await full(await order('piti', [['lungchai', 'มะม่วงน้ำดอกไม้ (กล่อง)', 1]], { fee: 30 }), 'somsak', [3, 'มะม่วงสุกเกินไปนิด', 'โอเค']);
  await full(await order('chujai', [['fon', 'บัวลอยไข่หวาน', 2], ['fon', 'ทับทิมกรอบ', 1]]), 'weera', [5, 'หวานกำลังดี', 'ใจดีมาก']);
  await full(await order('somying', [['heati', 'ชาเขียวมัทฉะ', 1]], { fee: 20 }), 'prayut', [4, 'มัทฉะเข้มดี', 'ตรงเวลา']);
  await full(await order('thanakorn', [['padaeng', 'ข้าวมันไก่ทอด', 2]]), 'somsak', null);
  // 2) ออเดอร์หลายร้านในครั้งเดียว
  await full(await order('manee', [['padaeng', 'ข้าวมันไก่ต้ม', 1], ['heati', 'ชานมไข่มุก', 1]], { note: 'รับ 2 ร้านนะคะ' }), 'weera', [5, 'ได้ครบทั้งสองร้าน', 'รับ 2 ร้านไม่งง']);

  // 3) ส่งถึงแล้ว รอลูกค้ายืนยัน
  { const o = await order('piti', [['ann', 'ขนมปังโฮลวีต', 2]]); await pay(o); await shopDo(o, 'preparing'); await shopDo(o, 'ready'); await riderAccept(o, 'prayut'); await riderPickup(o, 'prayut'); await riderDeliver(o, 'prayut'); }
  // 4) ไรเดอร์กำลังนำส่ง
  { const o = await order('chujai', [['lungchai', 'ฝรั่งกิมจู (ถุง)', 2]]); await pay(o); await shopDo(o, 'preparing'); await shopDo(o, 'ready'); await riderAccept(o, 'somsak'); await riderPickup(o, 'somsak'); }
  // 5) ไรเดอร์รับงานแล้ว กำลังไปร้าน
  { const o = await order('somying', [['fon', 'ทับทิมกรอบ', 2]]); await pay(o); await shopDo(o, 'preparing'); await shopDo(o, 'ready'); await riderAccept(o, 'weera'); }
  // 6) ร้านทำเสร็จ รอไรเดอร์
  { const o = await order('thanakorn', [['ann', 'บราวนี่ช็อกโกแลต', 3]]); await pay(o); await shopDo(o, 'preparing'); await shopDo(o, 'ready'); }
  // 7) ร้านกำลังทำ
  { const o = await order('manee', [['padaeng', 'ข้าวมันไก่ทอด', 1], ['padaeng', 'ซุปฟัก', 1]]); await pay(o); await shopDo(o, 'preparing'); }
  // 8) ร้านยกเลิก + ลูกค้าขอคืนเงิน + แอดมินอนุมัติ
  let cancelled1;
  { const o = await order('piti', [['heati', 'โกโก้เย็น', 3]], { fee: 20 }); await pay(o); await shopDo(o, 'cancelled', { reason: 'นมสดหมด ขออภัยครับ' }); cancelled1 = o; }
  { const o = await order('chujai', [['padaeng', 'ข้าวมันไก่ต้ม', 4]]); await shopDo(o, 'cancelled', { reason: 'ร้านปิดเร็วเพราะฝนตกหนัก' }); }
  await step('ปิติขอคืนเงินออเดอร์ที่ถูกยกเลิก', () => call('POST', '/refund-request', form({ user_id: people.piti.id, order_id: cancelled1.id, bank_name: 'กสิกรไทย', account_number: '555-6-77777-8', account_name: 'ปิติ ยินดี' }, { slip_image: ['#86efac', 'slip.png'] }), people.piti.dev));
  const [rf] = await q('SELECT id FROM refund_requests WHERE order_id = ?', [cancelled1.id]);
  await step('แอดมินอนุมัติคืนเงินให้ปิติ', () => call('PUT', `/admin/refund-status/${rf.id}`, { status: 'approved' }, A));
  // 9) จ่ายเงินแล้ว แต่ร้านยังไม่กดรับ (ถ้าร้านไม่รับภายใน 10 นาที ระบบจะยกเลิกอัตโนมัติ)
  { const o = await order('somying', [['lungchai', 'ฝรั่งกิมจู (ถุง)', 1]]); await pay(o); }

  // ==================== แจ้งปัญหา / ร้องเรียน ====================
  const doneOrder = made[3];
  await step(`${doneOrder.b.name} แจ้งปัญหาออเดอร์ #${doneOrder.id}`, () => call('POST', `/orders/${doneOrder.id}/issues`, { user_id: doneOrder.b.id, issue_topic: 'สินค้าไม่ตรงปก', issue_detail: 'มะม่วงช้ำ 2 ลูก' }, doneOrder.b.dev));
  const [iss] = await q('SELECT issue_id FROM order_issues WHERE order_id = ?', [doneOrder.id]);
  await step('แอดมินรับเรื่องปัญหาออเดอร์ (กำลังตรวจสอบ)', () => call('PUT', `/admin/tickets/${iss.issue_id}/status`, { status: 'investigating' }, A));
  await step('แอดมินปิดเรื่องปัญหาออเดอร์ (แก้ไขเรียบร้อย)', () => call('PUT', `/admin/tickets/${iss.issue_id}/status`, { status: 'resolved' }, A));
  await step('ชูใจส่งเรื่องร้องเรียน: แอปค้างตอนจ่ายเงิน', () => call('POST', '/complaints', form({ user_id: people.chujai.id, order_id: made[4].id, subject: 'แอปค้างตอนจ่ายเงิน', message: 'กดจ่ายเงินแล้วหน้าจอค้าง ต้องปิดแอปใหม่' }, { image: ['#fca5a5', 'screenshot.png'] }), people.chujai.dev));
  await step('ธนากรส่งเรื่องร้องเรียน: ไรเดอร์โทรไม่ติด', () => call('POST', '/complaints', form({ user_id: people.thanakorn.id, order_id: made[1].id, subject: 'ไรเดอร์โทรไม่ติด', message: 'โทรหาไรเดอร์ 3 ครั้งไม่รับสาย' }, { image: ['#fdba74', 'call-log.png'] }), people.thanakorn.dev));
  const cps = await q('SELECT id FROM complaints ORDER BY id');
  await step('แอดมินรับเรื่องร้องเรียนแรก', () => call('PUT', `/admin/complaints/${cps[0].id}/status`, { status: 'in_progress' }, A));
  await step('แอดมินปิดเรื่องร้องเรียนแรก', () => call('PUT', `/admin/complaints/${cps[0].id}/status`, { status: 'resolved' }, A));
  await step('แอดมินรับเรื่องร้องเรียนที่สอง', () => call('PUT', `/admin/complaints/${cps[1].id}/status`, { status: 'in_progress' }, A));

  // ==================== การเงิน ====================
  for (const k of ['padaeng', 'heati', 'ann']) await call('GET', `/seller/wallet/${shops[k].id}`, null, shops[k].owner.dev);
  const withdraw = async (k, amt) => { await step(`${shops[k].name} ขอถอนเงิน ${amt} บาท`, () => call('POST', '/seller/wallet/withdraw', { shop_id: shops[k].id, amount: amt }, shops[k].owner.dev)); return (await q('SELECT id FROM withdrawals WHERE shop_id = ? ORDER BY id DESC LIMIT 1', [shops[k].id]))[0].id; };
  const w1 = await withdraw('padaeng', 100);
  await step('แอดมินอนุมัติโอนเงินให้ข้าวมันไก่ป้าแดง', () => call('POST', `/admin/withdrawals/${w1}/approve`, {}, A));
  const w2 = await withdraw('heati', 30);
  await step('แอดมินปฏิเสธการถอนของเฮียตี๋ (ต่ำกว่าขั้นต่ำ)', () => call('POST', `/admin/withdrawals/${w2}/reject`, { reason: 'ยอดถอนต่ำกว่าขั้นต่ำ 50 บาท' }, A));
  await withdraw('ann', 80);
  await step('สมศักดิ์ขอถอนค่ารอบ 40 บาท', () => call('POST', '/rider/wallet/withdraw', { rider_id: riders.somsak.id, amount: 40 }, riders.somsak.dev));
  const [rw] = await q('SELECT id FROM withdrawals WHERE rider_id = ? ORDER BY id DESC LIMIT 1', [riders.somsak.id]);
  await step('แอดมินอนุมัติโอนค่ารอบให้สมศักดิ์', () => call('POST', `/admin/withdrawals/${rw.id}/approve`, {}, A));
  await step('วีระขอถอนค่ารอบ 30 บาท (รออนุมัติ)', () => call('POST', '/rider/wallet/withdraw', { rider_id: riders.weera.id, amount: 30 }, riders.weera.dev));

  // ==================== แอดมินอื่นๆ ====================
  await step('แอดมินระงับบัญชีชูใจชั่วคราว', () => call('PUT', `/admin/users/${people.chujai.id}/status`, { status: 'suspended', reason: 'ตรวจสอบการร้องเรียนซ้ำซ้อน' }, A));
  await step('ชูใจล็อกอินระหว่างถูกระงับ', () => call('POST', '/login', { identifier: people.chujai.email, password: PW }, people.chujai.dev), { expectFail: true });
  await step('แอดมินเปิดใช้งานบัญชีชูใจอีกครั้ง', () => call('PUT', `/admin/users/${people.chujai.id}/status`, { status: 'active' }, A));
  await step('แอดมินเพิ่มแบนเนอร์โปรโมชัน', () => call('POST', '/admin/banners', { image_url: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800', title: 'ลดกระหน่ำช่วงเย็น', subtitle: 'อาหารเหลือขายลดสูงสุด 50% หลัง 17:00', badge_text: 'Happy Hour', is_active: true }, A));
  await step('แอดมินปรับค่าส่งต่อกิโลเมตร', () => call('PUT', '/admin/settings', { settings: [{ setting_key: 'per_km_fee', setting_value: '9' }] }, A));
  await step('ลุงชัยปิดร้าน (ผลไม้หมดแล้ว)', () => call('PUT', `/seller/toggle-status/${shops.lungchai.id}`, { is_open: false }, shops.lungchai.owner.dev));
  await step('ประยุทธปิดรับงาน', () => call('PUT', `/rider/${riders.prayut.id}/online-status`, { is_online: false }, riders.prayut.dev));

  // ==================== อ่าน/ลบแจ้งเตือน ====================
  for (const k of ['somying', 'thanakorn', 'manee', 'padaeng', 'heati']) {
    const ns = await q('SELECT notification_id FROM notifications WHERE user_id = ? ORDER BY notification_id', [people[k].id]);
    for (const n of ns.slice(0, Math.ceil(ns.length * 0.6))) await call('PUT', `/notifications/${n.notification_id}/read`, null, people[k].dev);
    if (ns[0]) await call('DELETE', `/notifications/${ns[0].notification_id}`, null, people[k].dev);
  }
  for (const k of ['somsak', 'weera']) {
    const tok = Buffer.from(`${riders[k].userId}-${Date.now()}`).toString('base64');
    await call('GET', '/rider/notifications/unread', null, { ...riders[k].dev, Authorization: `Bearer ${tok}` });
  }
  console.log('✅ ผู้ใช้เปิดอ่าน/ลบแจ้งเตือนบางส่วน และแอปไรเดอร์แสดงแจ้งเตือนบนเครื่องแล้ว');
  for (const k of ['piti', 'manee']) await step(`${people[k].name} ออกจากระบบ`, () => call('POST', '/logout', { user_id: people[k].id, app_name: 'แอป Smart Deal (ลูกค้า/ร้านค้า)' }, people[k].dev));
  await step('ประยุทธออกจากระบบแอปไรเดอร์', () => call('POST', '/logout', { user_id: riders.prayut.userId, app_name: 'แอป Smart Deal Rider (ไรเดอร์)' }, riders.prayut.dev));
  await step('แอดมินออกจากระบบ', () => call('POST', '/admin/logout', null, A));

  const [[sum]] = await db.query('SELECT (SELECT COUNT(*) FROM orders) orders, (SELECT COUNT(*) FROM order_status_logs) timeline, (SELECT COUNT(*) FROM login_logs) logins, (SELECT COUNT(*) FROM admin_audit_logs) audits, (SELECT COUNT(*) FROM notifications) notifs, (SELECT COUNT(*) FROM transactions) ledger');
  console.log(`\n🎉 เสร็จแล้ว (${failures ? `❌ ล้มเหลว ${failures} ขั้น` : 'ทุกขั้นสำเร็จ'})`, sum);
  await db.end();
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('❌', e); process.exit(1); });
