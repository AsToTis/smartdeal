const fs = require('fs'); 
const content = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8'); 
const newContent = content.replace("path.extname(file.originalname || \\'.jpg\\')", "path.extname(file.originalname || '.jpg')"); 
fs.writeFileSync('c:/smartdeal/smart-deal-backend/src/server.js', newContent); 
console.log('Replaced');
