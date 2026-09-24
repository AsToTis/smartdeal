const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

const target1 = `    // 3. เติมเงินเข้า Wallet ร้านค้า + บันทึก Log
    if (targetShopId) {
      await connection.query(\`
        INSERT INTO shop_wallets (shop_id, balance) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)
      \`, [targetShopId, shopAmount]);

      await connection.query(\`
        INSERT INTO wallet_transactions (user_type, target_id, order_id, amount, type, description)
        VALUES ('shop', ?, ?, ?, 'credit', ?)
      \`, [targetShopId, effectiveOrderId, shopAmount, \\\`รายรับจากออเดอร์ #\${effectiveOrderId}\\\`]);
    }`;

const repl1 = `    // 3. (ถูกระงับด้วยระบบ Escrow) ไม่เติมเงินเข้า Wallet ร้านค้าทันที
    // เงินจะเข้ากระเป๋าร้านค้าเมื่อลูกค้ายืนยันการรับสินค้าผ่าน /api/orders/:orderId/complete
    /*
    if (targetShopId) {
      await connection.query(\`
        INSERT INTO shop_wallets (shop_id, balance) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)
      \`, [targetShopId, shopAmount]);

      await connection.query(\`
        INSERT INTO wallet_transactions (user_type, target_id, order_id, amount, type, description)
        VALUES ('shop', ?, ?, ?, 'credit', ?)
      \`, [targetShopId, effectiveOrderId, shopAmount, \\\`รายรับจากออเดอร์ #\${effectiveOrderId}\\\`]);
    }
    */`;

code = code.replace(/\/\/ 3\. เติมเงินเข้า Wallet ร้านค้า \+ บันทึก Log[\s\S]*?(?=\/\/ 4\. เติมเงินเข้า Wallet ไรเดอร์)/, repl1 + '\n\n    ');

const newApi = `

// ==========================================
// API ยืนยันรับสินค้า (Escrow System)
// ==========================================
app.put('/api/orders/:orderId/complete', async (req, res) => {
  const orderId = req.params.orderId;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.query('SELECT * FROM orders WHERE order_id = ? FOR UPDATE', [orderId]);
    if (orderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'ไม่พบคำสั่งซื้อ' });
    }

    const order = orderRows[0];
    if (order.order_status === 'completed') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'คำสั่งซื้อนี้เสร็จสมบูรณ์ไปแล้ว' });
    }

    // 1. อัปเดตสถานะเป็น completed
    await connection.query('UPDATE orders SET order_status = "completed" WHERE order_id = ?', [orderId]);

    // 2. คำนวณยอดเงินร้านค้าและโอนเข้า Wallet
    const shopId = order.shop_id;
    const totalAmount = parseFloat(order.total_amount) || 0;
    const deliveryFee = parseFloat(order.delivery_fee) || 0;
    const shopAmount = totalAmount - deliveryFee;

    if (shopId && shopAmount > 0) {
      await connection.query(\`
        INSERT INTO shop_wallets (shop_id, balance) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)
      \`, [shopId, shopAmount]);

      await connection.query(\`
        INSERT INTO wallet_transactions (user_type, target_id, order_id, amount, type, description)
        VALUES ('shop', ?, ?, ?, 'credit', ?)
      \`, [shopId, orderId, shopAmount, \\\`รายรับจากออเดอร์ #\${orderId}\\\`]);
    }

    await connection.commit();
    res.json({ success: true, message: 'ยืนยันรับสินค้าและโอนเงินให้ร้านค้าสำเร็จ' });
  } catch (error) {
    await connection.rollback();
    console.error('Order Complete Error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการยืนยันรับสินค้า' });
  } finally {
    connection.release();
  }
});
`;

code = code.replace(/app\.post\(\['\/api\/payments', '\/api\/payments\/confirm'\], async \(req, res\) => \{[\s\S]*?\}\);/, match => match + newApi);

// Also we need to replace the wallet API logic
const walletTargetRegex = /app\.get\('\/api\/seller\/wallet\/:shop_id', async \(req, res\) => \{[\s\S]*?const pending_amount = pendingData\[0\]\?\.pending_amount \|\| 0;[\s\S]*?res\.json\(\{ success: true, balance, pending_amount, history \}\);/;

const walletRepl = `app.get('/api/seller/wallet/:shop_id', async (req, res) => {
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
    
    res.json({ success: true, balance, pending_amount: pending_escrow, pending_withdrawal, history });`;

code = code.replace(walletTargetRegex, walletRepl);

fs.writeFileSync('server.js', code);
console.log('done');
