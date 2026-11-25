const fs = require('fs');
const content = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes("app.get('/api/home-data'"));
if (idx !== -1) {
  const endIdx = lines.findIndex((l, i) => i > idx && l.includes('const [deals] = await db.execute('));
  console.log(lines.slice(endIdx, endIdx !== -1 ? endIdx + 20 : idx + 80).join('\n'));
} else {
  console.log('Not found');
}
