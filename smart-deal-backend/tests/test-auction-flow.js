const http = require('http');
const db = require('../src/db');

function request(path, method, data) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

(async () => {
  console.log('--- 1. Testing GET /api/auctions/active ---');
  const activeRes = await request('/api/auctions/active', 'GET');
  console.log('Active auction:', activeRes.data.active_auction?.title, 'Current bid:', activeRes.data.active_auction?.current_bid);

  console.log('--- 2. Testing POST /api/auctions/1/bid ---');
  const currentBid = Number(activeRes.data.active_auction?.current_bid || 8900);
  const bidRes = await request('/api/auctions/1/bid', 'POST', {
    user_id: 2,
    bid_amount: currentBid + 100
  });
  console.log('Bid response:', bidRes);

  console.log('--- 3. Verifying Leaderboard in GET /api/auctions/1 ---');
  const detailRes = await request('/api/auctions/1', 'GET');
  console.log('Top bidder now:', detailRes.data.bids[0]);

  console.log('--- 4. Testing POST /api/auctions/1/close ---');
  const closeRes = await request('/api/auctions/1/close', 'POST');
  console.log('Close response:', closeRes);

  console.log('--- 5. Checking order created in orders table ---');
  const [orders] = await db.execute("SELECT order_id, user_id, order_type, total_amount, order_status FROM orders WHERE order_type = 'auction' ORDER BY order_id DESC LIMIT 1");
  console.log('Auction Order in Database:', orders[0]);

  // Reset auction #1 back to active for live demo
  const futureEndTime = new Date(Date.now() + (2 * 3600 + 43 * 60 + 44) * 1000).toISOString().slice(0, 19).replace('T', ' ');
  await db.execute("UPDATE auctions SET auction_status = 'active', end_time = ? WHERE auction_id = 1", [futureEndTime]);
  console.log('✅ Auction #1 restored to active for user demo!');

  process.exit(0);
})();
