// ==========================================================
// Smart Deal - Human-readable persistence helpers
// ทุกฟังก์ชันในไฟล์นี้ "ไม่ throw" เพื่อไม่ให้การบันทึก log ทำให้ flow หลักพัง
// ==========================================================
const { statusTh, roleTh } = require('../db/labels');

const safe = async (label, fn) => {
  try { return await fn(); } catch (e) { console.error(`⚠️ [audit:${label}]`, e.message); return null; }
};

const money = (n) => `฿${(parseFloat(n) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------- ข้อมูลเครื่อง / IP ----------
const clientInfo = (req) => {
  if (!req) return { ip: null, userAgent: null, device: null };
  const fwd = (req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  let ip = fwd || req.ip || req.socket?.remoteAddress || null;
  if (ip && ip.startsWith('::ffff:')) ip = ip.slice(7);
  const userAgent = (req.headers?.['user-agent'] || '').slice(0, 500) || null;
  const ua = userAgent || '';
  const device = req.headers?.['x-device-info']
    || (/okhttp|android/i.test(ua) ? 'Android (Expo/React Native)'
      : /iphone|ipad|cfnetwork|darwin/i.test(ua) ? 'iOS (Expo/React Native)'
        : /mozilla|chrome|safari|firefox|edg/i.test(ua) ? 'เว็บเบราว์เซอร์'
          : ua ? 'อุปกรณ์อื่น' : null);
  return { ip, userAgent, device };
};

// ---------- ผู้ดำเนินการ ----------
const actorUser = async (db, userId, type) => {
  if (!userId) return { type: type || 'system', id: null, name: type === 'buyer' ? 'ลูกค้า' : 'ระบบอัตโนมัติ' };
  const r = await safe('actorUser', () => db.query('SELECT full_name, role FROM users WHERE user_id = ?', [userId]));
  const u = r && r[0] && r[0][0];
  return { type: type || u?.role || 'buyer', id: Number(userId), name: u?.full_name || `ผู้ใช้ #${userId}` };
};

const actorShop = async (db, shopId) => {
  const r = await safe('actorShop', () => db.query(
    'SELECT s.name, s.owner_id, u.full_name FROM shops s LEFT JOIN users u ON u.user_id = s.owner_id WHERE s.shop_id = ?', [shopId]));
  const s = r && r[0] && r[0][0];
  const shopName = s?.name || `ร้าน #${shopId}`;
  return { type: 'seller', id: s?.owner_id || null, name: s?.full_name ? `${s.full_name} (ร้าน ${shopName})` : `ร้าน ${shopName}`, shopName, shopId: Number(shopId) || null };
};

const actorRider = async (db, riderId) => {
  const r = await safe('actorRider', () => db.query(
    'SELECT r.name, r.real_name, r.user_id, u.full_name FROM riders r LEFT JOIN users u ON u.user_id = r.user_id WHERE r.rider_id = ?', [riderId]));
  const x = r && r[0] && r[0][0];
  return { type: 'rider', id: Number(riderId) || null, userId: x?.user_id || null, name: x?.real_name || x?.name || x?.full_name || `ไรเดอร์ #${riderId}` };
};

// เว็บแอดมินส่ง header X-Admin-Name (encodeURIComponent) / X-Admin-Id มาได้ ถ้าไม่มีใช้ชื่อกลาง
const actorAdmin = (req) => {
  let name = req?.headers?.['x-admin-name'];
  try { name = name ? decodeURIComponent(name) : null; } catch (e) { /* keep raw */ }
  const id = parseInt(req?.headers?.['x-admin-id'], 10);
  return { type: 'admin', id: Number.isFinite(id) ? id : null, name: name || 'ผู้ดูแลระบบ (เว็บแอดมิน)' };
};

// ยืนยันชื่อแอดมินจากฐานข้อมูลด้วย X-Admin-Id (ถ้ามี) เพื่อไม่ให้ชื่อใน log ถูกปลอม
const adminActor = async (db, req) => {
  const a = actorAdmin(req);
  if (a.id) {
    const r = await safe('adminActor', () => db.query('SELECT full_name, email FROM users WHERE user_id = ? AND role = "admin"', [a.id]));
    const u = r && r[0] && r[0][0];
    if (u) return { type: 'admin', id: a.id, name: `${u.full_name} (${u.email})` };
    return { type: 'admin', id: null, name: `${a.name} (ไม่ยืนยันตัวตน)` };
  }
  return a;
};

// ตัดค่ารูปภาพ base64 ยาวๆ ออกก่อนเก็บใน log
const slim = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const o = { ...obj };
  for (const k of Object.keys(o)) if (typeof o[k] === 'string' && o[k].length > 300) o[k] = `${o[k].slice(0, 60)}... (${o[k].length} ตัวอักษร)`;
  return o;
};

const SYSTEM = { type: 'system', id: null, name: 'ระบบอัตโนมัติ' };

// ---------- login_logs ----------
const logLogin = (db, { req, user, appName, identifier, success, reason }) => safe('login', async () => {
  const { ip, userAgent, device } = clientInfo(req);
  const name = user?.full_name || null;
  const role = user?.role || null;
  const desc = success
    ? `${name} (${roleTh(role)}) เข้าสู่ระบบ ${appName} สำเร็จ`
    : `เข้าสู่ระบบ ${appName} ไม่สำเร็จด้วย "${identifier || '-'}"${reason ? ` : ${reason}` : ''}`;
  await db.query(
    `INSERT INTO login_logs (user_id, full_name, role, role_th, app_name, login_identifier, is_success, fail_reason, description_th, ip_address, user_agent, device_info)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user?.user_id || null, name || 'ไม่พบบัญชีผู้ใช้', role || 'unknown', role ? roleTh(role) : 'ไม่ทราบ (ไม่พบบัญชี)', appName, identifier || '-', success ? 1 : 0,
      success ? 'เข้าสู่ระบบสำเร็จ' : (reason || 'ไม่ระบุสาเหตุ'), desc, ip || 'ไม่ทราบ', userAgent || 'ไม่ทราบ', device || 'ไม่ทราบ']
  );
  if (success && user?.user_id) await db.query('UPDATE users SET last_login = NOW() WHERE user_id = ?', [user.user_id]);
});

// ---------- admin_audit_logs ----------
const toJson = (v) => (v === undefined || v === null ? null : typeof v === 'string' ? v : JSON.stringify(v));
const logAudit = (db, { req, actor, action, actionTh, entityType, entityId, entityName, description, oldValue, newValue }) => safe('audit', async () => {
  const { ip, userAgent } = clientInfo(req);
  const a = actor || SYSTEM;
  await db.query(
    `INSERT INTO admin_audit_logs (actor_type, actor_id, actor_name, action, action_th, entity_type, entity_id, entity_name, description_th, old_value, new_value, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.type, a.id || null, a.name, action, actionTh, entityType || null, entityId != null ? String(entityId) : null, entityName || null,
      description || `${a.name} ${actionTh}${entityName ? ` : ${entityName}` : ''}`,
      toJson(oldValue) ?? 'ไม่มีค่าเดิม (เป็นการสร้างใหม่หรือไม่ได้แก้ค่าใด)', toJson(newValue) ?? 'ไม่มีค่าใหม่ (เป็นการลบหรือไม่ได้แก้ค่าใด)', ip || 'ไม่ทราบ', userAgent || 'ไม่ทราบ']
  );
});

// เทียบค่าเก่า/ใหม่แล้วสร้างข้อความ "ราคา 50 → 45"
const diffText = (oldObj, newObj, labels) => {
  const parts = [];
  for (const [key, label] of Object.entries(labels)) {
    if (newObj[key] === undefined) continue;
    const o = oldObj ? oldObj[key] : undefined;
    const n = newObj[key];
    if (String(o ?? '') !== String(n ?? '')) parts.push(`${label}: ${o ?? '-'} → ${n ?? '-'}`);
  }
  return parts.join(', ');
};

// ---------- order_status_logs + timestamps ใน orders ----------
// timestamps: { accepted_at: true } = ตั้งเป็น NOW() ถ้ายังว่าง, { col: 'force' } = เขียนทับด้วย NOW()
const recordOrderEvent = (db, orderId, { event, fromStatus, toStatus, actor, description, shopId, shopName, timestamps, extra }) => safe('orderEvent', async () => {
  const sets = [];
  const params = [];
  for (const [col, mode] of Object.entries(timestamps || {})) {
    sets.push(mode === 'force' ? `\`${col}\` = NOW()` : `\`${col}\` = COALESCE(\`${col}\`, NOW())`);
  }
  for (const [col, val] of Object.entries(extra || {})) { sets.push(`\`${col}\` = ?`); params.push(val); }
  const [[order]] = await db.query('SELECT order_status, shop_id, shop_name FROM orders WHERE order_id = ?', [orderId]);
  const current = toStatus || order?.order_status || null;
  sets.push('status_th = ?'); params.push(statusTh(order?.order_status || current));
  await db.query(`UPDATE orders SET ${sets.join(', ')} WHERE order_id = ?`, [...params, orderId]);
  const a = actor || SYSTEM;
  await db.query(
    `INSERT INTO order_status_logs (order_id, shop_id, shop_name, event_code, from_status, to_status, status_th, description_th, actor_type, actor_id, actor_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, shopId || order?.shop_id || null, shopName || order?.shop_name || null, event,
      fromStatus || (event === 'created' ? 'new' : (order?.order_status || current)), current, statusTh(current), description, a.type, a.id || null, a.name]
  );
});

module.exports = {
  safe, money, clientInfo,
  actorUser, actorShop, actorRider, actorAdmin, adminActor, slim, SYSTEM,
  logLogin, logAudit, diffText, recordOrderEvent,
  statusTh, roleTh,
};
