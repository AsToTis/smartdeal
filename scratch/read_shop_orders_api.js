const fs = require('fs');
const content = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes("app.get('/api/shops/:shopId/orders'"));
if (idx !== -1) {
  const endIdx = lines.findIndex((l, i) => i > idx && l.includes('const [orders] = await db.execute('));
  console.log(lines.slice(idx, endIdx !== -1 ? endIdx + 15 : idx + 80).join('\n'));
} else {
  console.log('Not found');
}
