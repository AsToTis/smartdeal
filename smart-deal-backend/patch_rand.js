const fs = require('fs');
const file = 'src/server.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /WHERE a\.auction_status = 'active'\s*ORDER BY a\.end_time ASC/s;
const newStr = `WHERE a.auction_status = 'active'
      ORDER BY RAND()`;

if (content.match(regex)) {
  fs.writeFileSync(file, content.replace(regex, newStr));
  console.log('Patched active auctions ORDER BY RAND');
} else {
  console.log('Not patched');
}
