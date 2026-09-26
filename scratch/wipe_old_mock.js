const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'smart_deal_db'});
  
  // Get all order_ids that are not from today (or the ones we want to keep)
  // Let's just wipe ALL completed orders for shop 1 that are old mock data.
  // We'll keep the last 10 orders for shop 1.
  const [keep] = await conn.query('SELECT order_id FROM orders WHERE shop_id = 1 ORDER BY order_id DESC LIMIT 10');
  const keepIds = keep.map(k => k.order_id);
  
  // Delete all others for shop 1
  if (keepIds.length > 0) {
    await conn.query('DELETE FROM deliveries WHERE order_id IN (SELECT order_id FROM orders WHERE shop_id = 1) AND order_id NOT IN (?)', [keepIds]);
    await conn.query('DELETE FROM order_items WHERE order_id IN (SELECT order_id FROM orders WHERE shop_id = 1) AND order_id NOT IN (?)', [keepIds]);
    await conn.query('DELETE FROM reviews WHERE order_id IN (SELECT order_id FROM orders WHERE shop_id = 1) AND order_id NOT IN (?)', [keepIds]);
    await conn.query('DELETE FROM order_messages WHERE order_id IN (SELECT order_id FROM orders WHERE shop_id = 1) AND order_id NOT IN (?)', [keepIds]);
    await conn.query('DELETE FROM orders WHERE shop_id = 1 AND order_id NOT IN (?)', [keepIds]);
  }
  
  // Now sync wallet
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
  
  const [wallet] = await conn.query('SELECT balance FROM shop_wallets WHERE shop_id = 1');
  console.log('New wallet balance:', wallet[0]?.balance);
  conn.end();
}
run().catch(console.error);
