const fs = require('fs');
const file = 'src/server.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix order completion logic
const oldLogic = `    // 2. คำนวณยอดเงินร้านค้าและโอนเข้า Wallet
    const shopId = order.shop_id;
    const totalAmount = parseFloat(order.total_amount) || 0;
    const deliveryFee = parseFloat(order.delivery_fee) || 0;
    const shopAmount = totalAmount - deliveryFee;

    if (shopId && shopAmount > 0) {`;

const newLogic = `    // 2. คำนวณยอดเงินร้านค้าและโอนเข้า Wallet (หัก GP)
    const shopId = order.shop_id;
    const [settings] = await connection.query("SELECT setting_value FROM system_settings WHERE setting_key='platform_fee_percent'");
    const gpPercent = parseFloat(settings[0]?.setting_value || '0') / 100;
    const subtotal = parseFloat(order.subtotal) || 0;
    const shopAmount = subtotal * (1 - gpPercent);

    if (shopId && shopAmount > 0) {`;

content = content.replace(oldLogic, newLogic);

// 2. Fix wallet API to use wallet_transactions for history instead of orders
const oldWalletQuery = `const [orders] = await db.execute('SELECT order_id as id, total_amount as amount, created_at, "sale" as type FROM orders WHERE shop_id = ? AND order_status IN ("completed", "paid") ORDER BY created_at DESC LIMIT 20', [shop_id]);`;
const newWalletQuery = `const [orders] = await db.execute('SELECT order_id as id, amount, created_at, "sale" as type FROM wallet_transactions WHERE target_id = ? AND user_type="shop" AND type="credit" ORDER BY created_at DESC LIMIT 20', [shop_id]);`;
content = content.replace(oldWalletQuery, newWalletQuery);

fs.writeFileSync(file, content);
console.log('Fixed wallet logic successfully');
