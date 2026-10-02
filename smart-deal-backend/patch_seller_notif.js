const fs = require('fs');

function patchSellerNotifs() {
  const file = 'src/server.js';
  let content = fs.readFileSync(file, 'utf8');

  const oldStr = `      const formattedReviews = reviews.map(r => ({
        id: r.review_id,
        title: 'มีลูกค้ารีวิวสินค้า',
        body: \`ลูกค้า \${r.customer_name || 'ไม่ระบุชื่อ'} รีวิวสินค้า "\${r.product_name || 'สินค้า'}" \${r.rating} ดาว : \${r.comment || 'ไม่มีคอมเมนต์'}\`,
        type: 'review',
        created_at: r.created_at
      }));
      res.json({ success: true, notifications: formattedReviews });`;

  // We can just use a regex since the Thai text might be encoded differently.
  const targetRegex = /const formattedReviews = reviews\.map.*?res\.json\(\{ success: true, notifications: formattedReviews \}\);/s;

  const newStr = `const formattedReviews = reviews.map(r => ({
        id: r.review_id,
        title: 'มีลูกค้ารีวิวสินค้า',
        body: \`ลูกค้า \${r.customer_name || 'ไม่ระบุชื่อ'} รีวิวสินค้า "\${r.product_name || 'สินค้า'}" \${r.rating} ดาว : \${r.comment || 'ไม่มีคอมเมนต์'}\`,
        type: 'review',
        created_at: r.created_at
      }));

      // Fetch actual notifications for this shop owner
      const [shopRows] = await db.execute('SELECT owner_id FROM shops WHERE shop_id = ?', [shopId]);
      let realNotifs = [];
      if (shopRows.length > 0 && shopRows[0].owner_id) {
        const [nRows] = await db.execute('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [shopRows[0].owner_id]);
        realNotifs = nRows.map(n => ({
          id: 'n_' + n.notification_id,
          title: n.title,
          body: n.message,
          type: n.type,
          created_at: n.created_at
        }));
      }

      const combined = [...formattedReviews, ...realNotifs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      res.json({ success: true, notifications: combined });`;

  if (content.match(targetRegex)) {
    content = content.replace(targetRegex, newStr);
    fs.writeFileSync(file, content);
    console.log('Patched seller notifications API');
  } else {
    console.log('Target not found for seller notifications');
  }
}

patchSellerNotifs();
