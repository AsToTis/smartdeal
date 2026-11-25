const fs = require('fs');
const file = 'src/server.js';
let content = fs.readFileSync(file, 'utf8');

const targetRegex = /    \);\r?\n\r?\n    res\.json\(\{ success: true, message: 'แก้ไขข้อมูลสินค้าสำเร็จ' \}\);/;

const repl = `    );

    const [updatedProducts] = await db.execute('SELECT * FROM products WHERE product_id = ?', [productId]);
    if (updatedProducts.length > 0) {
      const product = updatedProducts[0];
      if (product.is_auction === 1) {
        const [existingAuctions] = await db.execute('SELECT auction_id FROM auctions WHERE shop_id = ? AND title = ? AND auction_status = \\'active\\'', [shopId, product.name]);
        if (existingAuctions.length === 0) {
          const [shops] = await db.execute('SELECT name FROM shops WHERE shop_id = ?', [shopId]);
          const shopName = shops.length > 0 ? shops[0].name : 'Unknown Shop';
          await db.execute(\`INSERT INTO auctions (title, description, image_url, shop_id, shop_name, start_price, current_bid, min_increment, end_time, auction_status, original_price, discount_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)\`, [product.name, product.description || '', product.image_url || '', shopId, shopName, product.discount_price || product.original_price || 0, product.discount_price || product.original_price || 0, 10, product.deal_end_time || new Date(Date.now() + 24*60*60*1000).toISOString().slice(0, 19).replace('T', ' '), product.original_price || 0, product.discount_percent || 0]);
        }
      }
    }

    res.json({ success: true, message: 'แก้ไขข้อมูลสินค้าสำเร็จ' });`;

if (targetRegex.test(content)) {
  fs.writeFileSync(file, content.replace(targetRegex, repl));
  console.log('Patched edit product');
} else {
  console.log('Target not found for edit product');
}
