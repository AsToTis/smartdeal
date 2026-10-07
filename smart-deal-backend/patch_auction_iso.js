const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'server.js');
let code = fs.readFileSync(filePath, 'utf8');

const target = "auction: {\n        ...auction,\n        start_price: startPrice,";
const replacement = "auction: {\n        ...auction,\n        end_time: auction.end_time ? new Date(auction.end_time).toISOString() : null,\n        start_price: startPrice,";

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('✅ Formatted auction end_time as ISO in server.js');
} else {
  // Try CRLF
  const targetCRLF = "auction: {\r\n        ...auction,\r\n        start_price: startPrice,";
  const replacementCRLF = "auction: {\r\n        ...auction,\r\n        end_time: auction.end_time ? new Date(auction.end_time).toISOString() : null,\r\n        start_price: startPrice,";
  if (code.includes(targetCRLF)) {
    code = code.replace(targetCRLF, replacementCRLF);
    fs.writeFileSync(filePath, code, 'utf8');
    console.log('✅ Formatted auction end_time as ISO in server.js (CRLF)');
  } else {
    console.log('Target not found directly');
  }
}
