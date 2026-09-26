const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'smart_deal_db'});
  
  // 1. Update the price in order_items to match the actual discount_price of the product
  await conn.query(`
    UPDATE order_items oi
    JOIN products p ON oi.product_id = p.product_id
    SET oi.price = p.discount_price
  `);

  // 2. Update the subtotal and total_amount in orders based on the sum of order_items (price * quantity)
  const [orders] = await conn.query('SELECT order_id FROM orders');
  for (let o of orders) {
    const [items] = await conn.query('SELECT SUM(price * quantity) as total FROM order_items WHERE order_id = ?', [o.order_id]);
    const total = items[0].total || 0;
    
    if (total > 0) {
      await conn.query('UPDATE orders SET subtotal = ?, total_amount = ? WHERE order_id = ?', [total, total, o.order_id]);
    }
  }

  // 3. Recalculate shop wallets based on real prices
  const [settings] = await conn.query("SELECT setting_value FROM system_settings WHERE setting_key='platform_fee_percent'");
  const gp = settings[0] ? parseFloat(settings[0].setting_value) : 0;
  const gpMult = 1 - (gp/100);
  
  const [shops] = await conn.query('SELECT shop_id FROM shops');
  for(let s of shops) {
    const [o] = await conn.query("SELECT SUM(subtotal * ?) as t FROM orders WHERE shop_id=? AND order_status='completed'", [gpMult, s.shop_id]);
    const [w] = await conn.query("SELECT SUM(amount) as w FROM withdrawals WHERE shop_id=?", [s.shop_id]);
    const earn = o[0].t || 0;
    const withdraw = w[0].w || 0;
    const bal = Math.max(0, earn - withdraw);
    await conn.query('INSERT INTO shop_wallets (shop_id, balance) VALUES (?, ?) ON DUPLICATE KEY UPDATE balance=?', [s.shop_id, bal, bal]);
  }

  console.log('Fixed prices and recalculated wallet');
  conn.end();
}

run().catch(console.error);
