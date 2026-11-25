const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'smart-deal-backend/src/server.js');
let lines = fs.readFileSync(serverFile, 'utf8').split('\n');

// Find line 4106 / 4107
for (let i = 0; i < lines.length - 2; i++) {
  if (lines[i].includes('res.status(500).json({ success: false, message: \'เกิดข้อผิดพลาดเซิร์ฟเวอร์\' });') &&
      lines[i+1].includes('}') &&
      lines[i+2].includes('});')) {
    // Check if next lines are extra
    if (lines[i+3] && lines[i+3].trim() === '}' && lines[i+4] && lines[i+4].trim() === '});') {
      console.log('Found extra closing brackets at line', i+4);
      lines.splice(i+3, 2);
      break;
    }
  }
}

fs.writeFileSync(serverFile, lines.join('\n'), 'utf8');
console.log('✅ Cleaned lines');
