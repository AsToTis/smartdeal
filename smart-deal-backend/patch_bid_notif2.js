const fs = require('fs');
const file = 'src/server.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /await connection\.commit\(\);\s*\/\/\s*(.*?) bids(.*?)Frontend/s;

const newStr = `const [shops] = await connection.query('SELECT owner_id FROM shops WHERE shop_id = ?', [auction.shop_id]);
    if (shops.length > 0 && shops[0].owner_id) {
      await connection.query(
        \`INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at)
         VALUES (?, ?, ?, 'shop_auction_bid', ?, 0, NOW())\`,
        [
          shops[0].owner_id,
          'มีผู้เสนอราคาใหม่ในห้องประมูล!',
          \`สินค้า "\${auction.title}" มีผู้เสนอราคาล่าสุดที่ ฿\${bidAmt.toLocaleString()}\`,
          auctionId
        ]
      );
    }

    await connection.commit();

    // $1 bids$2Frontend`;

if (content.match(regex)) {
  fs.writeFileSync(file, content.replace(regex, newStr));
  console.log('Patched bid notification');
} else {
  console.log('Not patched');
}
