const fs = require('fs');
const file = 'c:\\smartdeal\\smart-deal-backend\\src\\server.js';
let content = fs.readFileSync(file, 'utf8');

const oldStr1 = `const { name, address, opening_hours, bank_name, bank_account, latitude, longitude } = req.body;`;
const newStr1 = `const { name, address, opening_hours, bank_name, bank_account, latitude, longitude, opening_time, closing_time } = req.body;`;

const oldStr2 = `await db.execute('UPDATE shops SET name = ?, address = ?, opening_hours = ?, bank_name = ?, bank_account = ?, latitude = ?, longitude = ? WHERE shop_id = ?', [name, address, opening_hours, bank_name, bank_account, latitude || null, longitude || null, shop_id]);`;
const newStr2 = `    try {
      await db.execute('ALTER TABLE shops ADD COLUMN opening_time TIME DEFAULT "08:00:00", ADD COLUMN closing_time TIME DEFAULT "20:00:00"');
    } catch(e) {}
    
    await db.execute(
      'UPDATE shops SET name = ?, address = ?, opening_hours = ?, bank_name = ?, bank_account = ?, latitude = ?, longitude = ?, opening_time = IFNULL(?, opening_time), closing_time = IFNULL(?, closing_time) WHERE shop_id = ?', 
      [name, address, opening_hours, bank_name, bank_account, latitude || null, longitude || null, opening_time || null, closing_time || null, shop_id]
    );`;

if (content.includes(oldStr1) && content.includes(oldStr2)) {
  content = content.replace(oldStr1, newStr1).replace(oldStr2, newStr2);
  fs.writeFileSync(file, content);
  console.log('Patched PUT endpoint successfully');
} else {
  console.log('Could not find the target strings');
}
