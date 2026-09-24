const fs = require('fs');

const route = `
// 7. Rider Wallet API
app.get('/api/rider/wallet', async (req, res) => {
  // Try to get rider_id from auth token (mocked for now, assuming req.headers.authorization or we could pass rider_id as query)
  const riderId = req.query.rider_id;
  if (!riderId) return res.status(400).json({ success: false, message: 'Missing rider_id' });

  try {
    // Total Balance
    const [wallets] = await db.query('SELECT balance FROM rider_wallets WHERE rider_id = ?', [riderId]);
    let balance = 0;
    if (wallets.length > 0) {
      balance = wallets[0].balance;
    } else {
      // Calculate from deliveries - withdrawals
      const [delivs] = await db.query("SELECT SUM(o.delivery_fee) as earned FROM deliveries d JOIN orders o ON d.order_id = o.order_id WHERE d.rider_id = ? AND d.status = 'delivered'", [riderId]);
      // For withdrawals, maybe check wallet_transactions instead since withdrawals table only has shop_id
      const [withdraws] = await db.query("SELECT SUM(amount) as withdrawn FROM wallet_transactions WHERE user_type = 'rider' AND target_id = ? AND type = 'debit'", [riderId]);
      
      const earned = delivs[0].earned || 0;
      const withdrawn = withdraws[0].withdrawn || 0;
      balance = Number(earned) - Number(withdrawn);
    }

    // Today Income and Jobs
    const [todayStats] = await db.query("SELECT COUNT(d.id) as jobs, SUM(o.delivery_fee) as income FROM deliveries d JOIN orders o ON d.order_id = o.order_id WHERE d.rider_id = ? AND d.status = 'delivered' AND DATE(d.completed_at) = CURRENT_DATE()", [riderId]);
    const todayJobs = todayStats[0].jobs || 0;
    const todayIncome = todayStats[0].income || 0;

    // Transaction History (Deliveries and Withdrawals)
    const [deliveries] = await db.query("SELECT d.id, d.completed_at as created_at, o.delivery_fee as amount, 'credit' as type, s.name as description FROM deliveries d JOIN orders o ON d.order_id = o.order_id JOIN shops s ON o.shop_id = s.shop_id WHERE d.rider_id = ? AND d.status = 'delivered' ORDER BY d.completed_at DESC LIMIT 15", [riderId]);
    
    const [walletTx] = await db.query("SELECT id, created_at, amount, type, description FROM wallet_transactions WHERE user_type = 'rider' AND target_id = ? ORDER BY created_at DESC LIMIT 15", [riderId]);

    // Merge and sort
    let history = [...deliveries, ...walletTx];
    history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    history = history.slice(0, 20);

    res.json({ success: true, balance, todayIncome, todayJobs, history });
  } catch (error) {
    console.error('Wallet API error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
`;

let content = fs.readFileSync('server.js', 'utf8');
if (!content.includes('/api/rider/wallet')) {
  content = content.replace('// 6. Rider Earnings History', route + '\n// 6. Rider Earnings History');
  fs.writeFileSync('server.js', content);
  console.log('Added Wallet API');
} else {
  console.log('Wallet API already exists');
}
