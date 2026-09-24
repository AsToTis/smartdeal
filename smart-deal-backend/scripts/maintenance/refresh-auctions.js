const db = require('../../src/db');

async function refreshAuctions() {
  const endTime1 = new Date(Date.now() + 2.5 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const endTime2 = new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const endTime3 = new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  await db.execute("UPDATE auctions SET auction_status = 'active', end_time = ? WHERE auction_id = 1", [endTime1]);
  await db.execute("UPDATE auctions SET auction_status = 'active', end_time = ? WHERE auction_id = 2", [endTime2]);
  await db.execute("UPDATE auctions SET auction_status = 'active', end_time = ? WHERE auction_id = 3", [endTime3]);

  const [rows] = await db.execute('SELECT auction_id, title, current_bid, auction_status, end_time FROM auctions');
  console.log('✅ Active auctions in DB:', rows);
  process.exit(0);
}

refreshAuctions().catch(e => {
  console.error('Error refreshing auctions:', e);
  process.exit(1);
});
