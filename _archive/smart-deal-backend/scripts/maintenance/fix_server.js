const fs = require('fs');
let content = fs.readFileSync('C:/smartdeal/server.js', 'utf8');
const search =     const [rows] = await db.execute(
      SELECT w.id, w.amount, w.status, w.created_at, s.name as shop_name, s.bank_name, s.bank_account
      FROM withdrawals w
      JOIN shops s ON w.shop_id = s.shop_id
      WHERE w.status = "pending"
      ORDER BY w.created_at DESC
    );;
const replace =     const [rows] = await db.execute(
      \SELECT w.id, w.amount, w.status, w.created_at, s.name as shop_name, s.bank_name, s.bank_account, s.bookbank_image
      FROM withdrawals w
      JOIN shops s ON w.shop_id = s.shop_id
      WHERE w.status = "pending"
      ORDER BY w.created_at DESC\
    );;
content = content.replace(search, replace);
fs.writeFileSync('C:/smartdeal/server.js', content, 'utf8');
