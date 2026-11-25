const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'smart_deal_db'});
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
