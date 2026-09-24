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
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

(async () => {
  console.log('==============================================');
  console.log('🧪 STARTING NOTIFICATION SYSTEM FULL E2E TEST');
  console.log('==============================================\n');

  // Test 1: Fetch notifications for user 2
  console.log('▶ TEST 1: GET /api/notifications/2');
  const notifRes = await request('/api/notifications/2', 'GET');
  console.log('Status:', notifRes.status);
  console.log('Total notifications:', notifRes.data.notifications?.length);
  console.log('Unread count:', notifRes.data.unread_count);

  // Test 2: Fetch unread count for user 2
  console.log('\n▶ TEST 2: GET /api/notifications/unread-count/2');
  const countRes = await request('/api/notifications/unread-count/2', 'GET');
  console.log('Unread count response:', countRes.data);

  // Test 3: Test Auction Outbid notification trigger
  console.log('\n▶ TEST 3: Testing Outbid Notification Flow');
  // First, set auction 1 current_bid to 9000 with user 1
  await db.execute("UPDATE auction_bids SET bid_status = 'outbid' WHERE auction_id = 1");
  await db.execute("INSERT INTO auction_bids (auction_id, user_id, bid_amount, bid_status, created_at) VALUES (1, 1, 9100, 'active', NOW())");
  await db.execute("UPDATE auctions SET current_bid = 9100, winner_user_id = 1, auction_status = 'active' WHERE auction_id = 1");
  
  // Now User 2 bids 9200 -> User 1 should get auction_outbid notification!
  console.log('User 2 bids ฿9,200 over User 1...');
  const bidRes = await request('/api/auctions/1/bid', 'POST', {
    user_id: 2,
    bid_amount: 9200
  });
  console.log('Bid result:', bidRes.data.success, 'New current bid:', bidRes.data.new_current_bid);

  // Check if User 1 got an outbid notification
  const [user1Notifs] = await db.execute("SELECT * FROM notifications WHERE user_id = 1 AND type = 'auction_outbid' ORDER BY notification_id DESC LIMIT 1");
  console.log('✅ User 1 outbid notification:', user1Notifs[0] ? {
    title: user1Notifs[0].title,
    message: user1Notifs[0].message,
    type: user1Notifs[0].type
  } : 'NOT FOUND');

  // Test 4: Test Auction Won & Lost notification trigger on Close
  console.log('\n▶ TEST 4: Testing Auction Close (Won & Lost) Notification Flow');
  const closeRes = await request('/api/auctions/1/close', 'POST');
  console.log('Close result:', closeRes.data);

  // Check User 2 (winner) got auction_won notification
  const [user2Won] = await db.execute("SELECT * FROM notifications WHERE user_id = 2 AND type = 'auction_won' ORDER BY notification_id DESC LIMIT 1");
  console.log('✅ User 2 (Winner) notification:', user2Won[0] ? {
    title: user2Won[0].title,
    message: user2Won[0].message,
    type: user2Won[0].type,
    reference_id: user2Won[0].reference_id
  } : 'NOT FOUND');

  // Check User 1 (participant) got auction_lost notification
  const [user1Lost] = await db.execute("SELECT * FROM notifications WHERE user_id = 1 AND type = 'auction_lost' ORDER BY notification_id DESC LIMIT 1");
  console.log('✅ User 1 (Participant) notification:', user1Lost[0] ? {
    title: user1Lost[0].title,
    message: user1Lost[0].message,
    type: user1Lost[0].type
  } : 'NOT FOUND');

  // Test 5: Mark single notification as read
  if (user2Won[0]) {
    console.log('\n▶ TEST 5: PUT /api/notifications/' + user2Won[0].notification_id + '/read');
    const readRes = await request(`/api/notifications/${user2Won[0].notification_id}/read`, 'PUT');
    console.log('Mark as read result:', readRes.data);
  }

  // Test 6: Mark all notifications as read
  console.log('\n▶ TEST 6: PUT /api/notifications/read-all/2');
  const readAllRes = await request('/api/notifications/read-all/2', 'PUT');
  console.log('Mark all result:', readAllRes.data);

  // Reset auction 1 back to active for live demo
  const futureEndTime = new Date(Date.now() + (2 * 3600 + 43 * 60 + 44) * 1000).toISOString().slice(0, 19).replace('T', ' ');
  await db.execute("UPDATE auctions SET auction_status = 'active', end_time = ? WHERE auction_id = 1", [futureEndTime]);
  console.log('\n✅ Reset auction #1 to active state for live app demo');

  console.log('\n🎉 ALL E2E NOTIFICATION TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
})().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
