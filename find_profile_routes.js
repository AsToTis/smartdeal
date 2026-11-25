const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'smart-deal-backend/src/server.js');
const content = fs.readFileSync(serverFile, 'utf8');

const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('/profile') || line.includes('/password') || line.includes('change-password')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
});
