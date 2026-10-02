const mysql = require('mysql2/promise');
async function run() {
  const db = await mysql.createConnection({host:'localhost', user:'root', database:'smart_deal_db'});
  try {
    await db.execute("UPDATE shops SET name=?, description=?, category_id=?, address=?, latitude=?, longitude=?, bank_name=?, bank_account=?, id_card_image=?, bookbank_image=?, status='pending' WHERE owner_id=?", ['Test', 'Test desc', '1', 'Address', '13.725109', '100.569109', 'KBANK', '123', null, null, 28]);
    console.log('Update OK');
  } catch(e) {
    console.error('Error:', e);
  }
  process.exit(0);
}
run();
