const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

const inject = `app.get('/api/shops/:shopId/stats', async (req, res) => {
  const { shopId } = req.params;
  try {
    const [salesRow] = await db.execute("SELECT SUM(total_amount) AS total_revenue, COUNT(*) AS total_orders FROM orders WHERE shop_id = ? AND order_status IN ('paid', 'completed')", [shopId]);
    const [pendingRow] = await db.execute("SELECT COUNT(*) AS pending_orders FROM orders WHERE shop_id = ? AND order_status IN ('pending', 'preparing')", [shopId]);
    const [todayRow] = await db.execute("SELECT SUM(total_amount) AS today_revenue FROM orders WHERE shop_id = ? AND order_status IN ('paid', 'completed') AND DATE(created_at) = CURDATE()", [shopId]);
    const [productsRow] = await db.execute(
`;

lines.splice(2289, 0, inject);
fs.writeFileSync('server.js', lines.join('\n'));
console.log('Fixed server.js');
