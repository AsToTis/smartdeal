const fs = require('fs');
let code = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8');

let newCode = code.replace(
  "      LEFT JOIN users u_rider ON r.user_id = u_rider.user_id\r\n      WHERE orders.user_id = ?",
  "      LEFT JOIN users u_rider ON r.user_id = u_rider.user_id\r\n      LEFT JOIN users u_customer ON orders.user_id = u_customer.user_id\r\n      WHERE orders.user_id = ?"
);

// Fallback in case the newlines are \n
if (newCode === code) {
  newCode = code.replace(
    "      LEFT JOIN users u_rider ON r.user_id = u_rider.user_id\n      WHERE orders.user_id = ?",
    "      LEFT JOIN users u_rider ON r.user_id = u_rider.user_id\n      LEFT JOIN users u_customer ON orders.user_id = u_customer.user_id\n      WHERE orders.user_id = ?"
  );
}

fs.writeFileSync('c:/smartdeal/smart-deal-backend/src/server.js', newCode);
console.log('Replaced successfully! Length diff:', newCode.length - code.length);
