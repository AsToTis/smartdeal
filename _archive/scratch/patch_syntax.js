const fs = require('fs');
const path = 'c:/smartdeal/smart-deal-backend/src/server.js';
let content = fs.readFileSync(path, 'utf8');
content = content.replace("name: s.name || s.name as shop_name || ''", "name: s.name || ''");
fs.writeFileSync(path, content, 'utf8');
console.log('Done');
