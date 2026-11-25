const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'smart-deal-backend/src/server.js');
const content = fs.readFileSync(serverFile, 'utf8');

const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('Distance') || line.includes('distance') || line.includes('fare') || line.includes('Fare')) {
    if (line.includes('function') || line.includes('const') || line.includes('let') || line.includes('app.')) {
      console.log(`Line ${i + 1}: ${line.trim()}`);
    }
  }
});
