const fs = require('fs');
const content = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes("app.get('/api/orders/shop/"));
if (idx !== -1) {
  const endIdx = lines.findIndex((l, i) => i > idx && l.includes('res.json'));
  console.log(lines.slice(idx, endIdx !== -1 ? endIdx + 5 : idx + 80).join('\n'));
} else {
  console.log('Not found');
}
