const fs = require('fs');
const file = 'src/server.js';
let content = fs.readFileSync(file, 'utf8');

// Replace { success: true, data: formattedComplaints } with just formattedComplaints
content = content.replace(
  `res.json({ success: true, data: formattedComplaints });`,
  `res.json(formattedComplaints);`
);

fs.writeFileSync(file, content);
console.log('Fixed admin complaints response format');
