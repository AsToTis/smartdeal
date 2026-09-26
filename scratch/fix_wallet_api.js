const fs = require('fs');

let serverCode = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8');

const targetWalletAPI = `app.get('/api/seller/wallet/:shop_id', async (req, res) => {
  try {
    const shop_id = req.params.shop_id;
    await db.execute('INSERT IGNORE INTO shop_wallets (shop_id, balance) VALUES (?, 0)', [shop_id]);
    const [walletData] = await db.execute('SELECT balance FROM shop_wallets WHERE shop_id = ?', [shop_id]);
    const balance = walletData[0]?.balance || 0;
    
    // ดึงยอดถอนที่รอดำเนินการ
    const [pendingWithdrawData] = await db.execute('SELECT SUM(amount) as pending_amount FROM withdrawals WHERE shop_id = ? AND status = "pending"', [shop_id]);
    const pending_withdrawal = pendingWithdrawData[0]?.pending_amount || 0;
    
    // ดึงยอดเงิน Escrow (ออเดอร์ที่จ่ายแล้ว/กำลังส่ง แต่ยังไม่กดยืนยันรับ)
    const [pendingEscrowData] = await db.execute('SELECT SUM(total_amount - delivery_fee) as pending_escrow FROM orders WHERE shop_id = ? AND order_status IN ("paid", "shipped", "pending")', [shop_id]);
    const pending_escrow = pendingEscrowData[0]?.pending_escrow || 0;

    const [orders] = await db.execute('SELECT order_id as id, total_amount as amount, created_at, "sale" as type FROM orders WHERE shop_id = ? AND order_status IN ("completed", "paid") ORDER BY created_at DESC LIMIT 20', [shop_id]);
    const [withdrawals] = await db.execute('SELECT id, amount, created_at, status, "withdrawal" as type FROM withdrawals WHERE shop_id = ? ORDER BY created_at DESC LIMIT 20', [shop_id]);
    const history = [...orders, ...withdrawals].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30);
    
    // ส่งกลับไปให้แสดงผล (ใช้ pending_amount รับค่า escrow ไปเพื่อให้ frontend เดิมทำงานได้)
    res.json({ success: true, balance, pending_amount: pending_escrow, pending_withdrawal, history });`;

const replacementWalletAPI = `app.get('/api/seller/wallet/:shop_id', async (req, res) => {
  try {
    const shop_id = req.params.shop_id;
    
    // ดึงค่า GP ปัจจุบัน
    const [setting] = await db.execute("SELECT setting_value FROM system_settings WHERE setting_key='platform_fee_percent'");
    const gpPercent = setting.length > 0 ? parseFloat(setting[0].setting_value) || 0 : 0;
    const gpMultiplier = 1 - (gpPercent / 100);

    // ดึงยอดเงิน Escrow (ออเดอร์ที่จ่ายแล้ว/กำลังส่ง แต่ยังไม่กดยืนยันรับ)
    const [pendingEscrowData] = await db.execute('SELECT SUM(subtotal * ?) as pending_escrow FROM orders WHERE shop_id = ? AND order_status IN ("paid", "shipped", "pending", "preparing", "ready", "finding_rider", "delivering")', [gpMultiplier, shop_id]);
    const pending_escrow = pendingEscrowData[0]?.pending_escrow || 0;

    // ดึงยอดที่รอถอน
    const [pendingWithdrawData] = await db.execute('SELECT SUM(amount) as pending_amount FROM withdrawals WHERE shop_id = ? AND status = "pending"', [shop_id]);
    const pending_withdrawal = pendingWithdrawData[0]?.pending_amount || 0;

    // คำนวณยอดเงินที่สามารถถอนได้ = รายได้สุทธิจากออเดอร์ที่ completed - ยอดที่ถอนไปแล้วทั้งหมด (รวม pending)
    const [totalEarningsData] = await db.execute('SELECT SUM(subtotal * ?) as total_earnings FROM orders WHERE shop_id = ? AND order_status = "completed"', [gpMultiplier, shop_id]);
    const total_earnings = totalEarningsData[0]?.total_earnings || 0;

    const [totalWithdrawnData] = await db.execute('SELECT SUM(amount) as total_withdrawn FROM withdrawals WHERE shop_id = ?', [shop_id]);
    const total_withdrawn = totalWithdrawnData[0]?.total_withdrawn || 0;

    const calculated_balance = Math.max(0, total_earnings - total_withdrawn);

    // อัปเดตตาราง shop_wallets ให้ตรงกับความจริง
    await db.execute('INSERT IGNORE INTO shop_wallets (shop_id, balance) VALUES (?, 0)', [shop_id]);
    await db.execute('UPDATE shop_wallets SET balance = ? WHERE shop_id = ?', [calculated_balance, shop_id]);

    // ประวัติ
    const [orders] = await db.execute('SELECT order_id as id, (subtotal * ?) as amount, created_at, "sale" as type FROM orders WHERE shop_id = ? AND order_status = "completed" ORDER BY created_at DESC LIMIT 100', [gpMultiplier, shop_id]);
    const [withdrawals] = await db.execute('SELECT id, amount, created_at, status, "withdrawal" as type FROM withdrawals WHERE shop_id = ? ORDER BY created_at DESC LIMIT 100', [shop_id]);
    const history = [...orders, ...withdrawals].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // ส่งกลับไปให้แสดงผล
    res.json({ success: true, balance: calculated_balance, pending_amount: pending_escrow, pending_withdrawal, history });`;

serverCode = serverCode.replace(targetWalletAPI, replacementWalletAPI);
fs.writeFileSync('c:/smartdeal/smart-deal-backend/src/server.js', serverCode);
console.log('Fixed server.js wallet API');
