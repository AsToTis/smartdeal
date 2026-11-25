const fs = require('fs');
const content = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes("app.get('/api/admin/shops',"));
if (idx !== -1) {
  console.log(lines.slice(idx, idx + 30).join('\n'));
} else {
  console.log('Not found');
}
