const mysql = require('mysql2/promise');

async function run() {
  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'smart_deal_db'
  });
  
  const [wallet] = await db.query('DESCRIBE rider_wallets');
  console.log('RIDER_WALLETS:', wallet);
  
  const [w_tx] = await db.query('DESCRIBE wallet_transactions');
  console.log('WALLET_TX:', w_tx);
  
  const [dels] = await db.query('DESCRIBE deliveries');
  console.log('DELIVERIES:', dels);
  
  await db.end();
}
run();
