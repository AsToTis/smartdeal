const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'smart_deal_db'});
  
  // 1. Keep only 50 mock orders, delete the rest (to avoid huge balances and lag)
  // To avoid foreign key issues, we first find the IDs to keep.
  const [rows] = await conn.query('SELECT order_id FROM orders WHERE order_id > 2000 LIMIT 50');
  const keepIds = rows.map(r => r.order_id);
  
  if (keepIds.length > 0) {
    // Delete deliveries and order_items for orders NOT in keepIds (order_id > 2000)
    await conn.query(`DELETE FROM deliveries WHERE order_id > 2000 AND order_id NOT IN (?)`, [keepIds]);
    await conn.query(`DELETE FROM order_items WHERE order_id > 2000 AND order_id NOT IN (?)`, [keepIds]);
    await conn.query(`DELETE FROM reviews WHERE order_id > 2000 AND order_id NOT IN (?)`, [keepIds]);
    await conn.query(`DELETE FROM order_messages WHERE order_id > 2000 AND order_id NOT IN (?)`, [keepIds]);
    await conn.query(`DELETE FROM orders WHERE order_id > 2000 AND order_id NOT IN (?)`, [keepIds]);
    console.log('Deleted excess mock orders');
    
    // 2. Randomize statuses for the 50 kept orders
    const statuses = ['pending', 'paid', 'preparing', 'shipped', 'delivered', 'completed', 'cancelled'];
    for (let i = 0; i < keepIds.length; i++) {
      const orderId = keepIds[i];
      const status = statuses[i % statuses.length];
      await conn.query('UPDATE orders SET order_status = ? WHERE order_id = ?', [status, orderId]);
      
      // 3. If completed, add a mock review
      if (status === 'completed') {
        // Check if there's a product for this order
        const [items] = await conn.query('SELECT product_id FROM order_items WHERE order_id = ? LIMIT 1', [orderId]);
        if (items.length > 0) {
          const productId = items[0].product_id;
          const rating = Math.floor(Math.random() * 2) + 4; // 4 or 5
          const comments = rating === 5 ? 'อร่อยมากครับ ส่งไว' : 'ดีครับ แต่อยากให้เผ็ดกว่านี้หน่อย';
          // insert review if not exists
          await conn.query('INSERT IGNORE INTO reviews (order_id, user_id, shop_id, product_id, rating, comment) VALUES (?, 1, 1, ?, ?, ?)', [orderId, productId, rating, comments]);
        }
      }
    }
    console.log('Randomized statuses and added mock reviews');
  }

  // 4. Sync wallets again
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
  console.log('Synced wallets');

  conn.end();
}

run().catch(console.error);
