const fs = require('fs');
const content = fs.readFileSync('c:/smartdeal/server.js', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes("app.get('/api/products/:id',"));
if (idx !== -1) {
  console.log(lines.slice(idx, idx + 40).join('\n'));
} else {
  console.log('Not found /api/products/:id in c:/smartdeal/server.js');
}
