const fs = require('fs');
const content = fs.readFileSync('src/server.js', 'utf8');
const lines = content.split('\n');
const orderLines = [];
lines.forEach((line, idx) => {
  if (line.includes('/api/orders') || line.includes('/status') || line.includes('deliveries') || line.includes('UPDATE orders')) {
    orderLines.push({ line: idx + 1, text: line.trim() });
  }
});
console.log(JSON.stringify(orderLines.slice(0, 30), null, 2));
