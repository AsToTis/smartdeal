const fs = require('fs');
const content = fs.readFileSync('src/server.js', 'utf8');
const lines = content.split('\n');
const list = [];
lines.forEach((line, idx) => {
  if (line.includes('notifications')) {
    list.push({ line: idx + 1, text: line.trim() });
  }
});
console.log(JSON.stringify(list, null, 2));
