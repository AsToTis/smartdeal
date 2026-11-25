const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'smart-deal-backend/src/server.js');
const content = fs.readFileSync(serverFile, 'utf8');

const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.toLowerCase().includes('setting') && (line.includes('app.get') || line.includes('app.post') || line.includes('app.put') || line.includes('SELECT') || line.includes('UPDATE'))) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
});
