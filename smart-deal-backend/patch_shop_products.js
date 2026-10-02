const fs = require('fs');
const file = 'src/server.js';
let content = fs.readFileSync(file, 'utf8');

const targetRegex = /WHERE p\.shop_id = \?\s*ORDER BY p\.product_id DESC/;
const repl = `WHERE p.shop_id = ?
      ORDER BY p.deal_end_time IS NULL ASC, p.deal_end_time ASC, p.product_id DESC`;

if (targetRegex.test(content)) {
  fs.writeFileSync(file, content.replace(targetRegex, repl));
  console.log('Patched shop products query');
} else {
  console.log('Not patched');
}
