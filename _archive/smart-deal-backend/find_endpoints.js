const fs = require('fs');
const content = fs.readFileSync('src/server.js', 'utf8');
const lines = content.split('\n');
const list = [];
lines.forEach((line, idx) => {
  if (line.includes('app.put') || line.includes('app.post') || line.includes('app.patch')) {
    if (line.includes('delivery') || line.includes('deliveries') || line.includes('order') || line.includes('rider') || line.includes('status')) {
      list.push({ line: idx + 1, text: line.trim() });
    }
  }
});
console.log(JSON.stringify(list, null, 2));
