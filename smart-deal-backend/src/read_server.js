const fs = require('fs');
const lines = fs.readFileSync(__dirname + '/server.js', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('app.get(\'/api/admin/withdrawals\''));
console.log(lines.slice(idx, idx + 40).join('\n'));