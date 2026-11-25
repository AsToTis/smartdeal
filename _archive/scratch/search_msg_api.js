const fs = require('fs');
const content = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8');
const lines = content.split('\n');
const results = lines.map((l, i) => l.includes('/messages') ? i + ': ' + l : null).filter(Boolean);
console.log(results.join('\n'));
