const fs = require('fs');
const content = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes("app.get('/api/seller/dashboard'"));
if (idx !== -1) {
  const endIdx = lines.findIndex((l, i) => i > idx && l.startsWith('app.'));
  console.log(lines.slice(idx, endIdx !== -1 ? endIdx : idx + 80).join('\n'));
} else {
  console.log('Not found');
}
