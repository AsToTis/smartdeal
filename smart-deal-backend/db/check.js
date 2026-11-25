// ตรวจสุขภาพฐานข้อมูล: npm run db:check
const mysql = require('mysql2/promise');
const { resolveDbConfig } = require('./config');

const REQUIRED = {
  users: ['user_id', 'full_name', 'role', 'status', 'last_login', 'push_token'],
  shops: ['shop_id', 'name', 'status', 'is_open', 'status_updated_by'],
  products: ['product_id', 'name', 'stock_quantity', 'discount_price'],
  orders: ['order_id', 'shop_name', 'buyer_name', 'items_summary', 'status_th', 'accepted_at', 'prepared_at',
    'rider_name', 'rider_assigned_at', 'picked_up_at', 'delivered_at', 'completed_at', 'cancelled_at', 'cancel_reason', 'paid_at'],
  order_items: ['product_name', 'price', 'original_price', 'line_total', 'shop_name'],
  order_status_logs: ['order_id', 'event_code', 'description_th', 'actor_name', 'created_at'],
  login_logs: ['user_id', 'full_name', 'role', 'app_name', 'is_success', 'ip_address', 'created_at'],
  notifications: ['user_id', 'recipient_name', 'title', 'message', 'is_read', 'read_at'],
  admin_audit_logs: ['actor_name', 'action_th', 'entity_name', 'description_th', 'old_value', 'new_value'],
  transactions: ['shop_id', 'type', 'description'],
  wallet_transactions: ['user_type', 'target_name', 'amount', 'description'],
  payments: ['order_id', 'amount', 'paid_at', 'payer_name'],
  withdrawals: ['requester_name', 'status', 'processed_by_name'],
  user_coupons: ['code', 'is_used', 'order_id'],
  refund_requests: ['order_id', 'status', 'processed_by_name'],
};

(async () => {
  const cfg = resolveDbConfig();
  console.log(`🗄️  Profile: ${cfg.profile} -> ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);
  const conn = await mysql.createConnection({ host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database, ssl: cfg.ssl });
  const [[ver]] = await conn.query('SELECT VERSION() AS v');
  console.log(`✅ เชื่อมต่อสำเร็จ (MySQL/MariaDB ${ver.v})`);
  let problems = 0;
  const rows = [];
  for (const [table, cols] of Object.entries(REQUIRED)) {
    const [c] = await conn.query('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=?', [cfg.database, table]);
    const have = new Set(c.map(x => x.COLUMN_NAME));
    const missing = cols.filter(x => !have.has(x));
    let count = '-';
    if (have.size) { const [[n]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\``); count = n.n; }
    if (!have.size || missing.length) problems++;
    rows.push({ table, rows: count, status: !have.size ? '❌ ไม่มีตาราง' : missing.length ? `❌ ขาด ${missing.join(', ')}` : '✅' });
  }
  console.table(rows);
  await conn.end();
  if (problems) { console.log(`❌ พบปัญหา ${problems} ตาราง - รัน npm run db:migrate`); process.exit(1); }
  console.log('✅ Schema ครบถ้วน');
})().catch(e => { console.error('❌', e.message); process.exit(1); });
