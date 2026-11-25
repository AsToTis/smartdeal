const fs = require('fs');
const content = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes("app.get('/api/products/:id',"));
if (idx !== -1) {
  console.log(lines.slice(idx + 15, idx + 40).join('\n'));
} else {
  console.log('Not found /api/products/:id');
}
