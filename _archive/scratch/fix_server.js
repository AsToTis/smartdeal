const fs = require('fs');
const file = 'c:/smartdeal/smart-deal-backend/src/server.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace("name: s.name || s.name as shop_name || ''", "name: s.name || s.shop_name || ''");
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed server.js');
