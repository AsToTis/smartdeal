const fs = require('fs');
const content = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8');
const lines = content.split('\n');
lines.forEach(l => {
  if (l.includes("app.get('/api/") && l.includes('order')) {
    console.log(l.trim());
  }
});
