const fs = require('fs');
const file = 'src/server.js';
let content = fs.readFileSync(file, 'utf8');
const oldStr = "WHERE p.name LIKE ? AND s.status = 'approved'`";
const newStr = "WHERE p.name LIKE ? AND s.status = 'approved' ORDER BY p.deal_end_time IS NULL ASC, p.deal_end_time ASC`";
if (content.includes(oldStr)) {
  fs.writeFileSync(file, content.replace(oldStr, newStr));
  console.log('Patched search query');
} else {
  console.log('Not patched');
}
