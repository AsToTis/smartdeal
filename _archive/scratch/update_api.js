const fs = require('fs');
let code = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8');

const replacement = `
    const [reviews] = await db.execute('SELECT rating, comment, created_at FROM reviews WHERE order_id = ? LIMIT 1', [orderId]);
    res.json({
      success: true,
      order: {
        ...order,
        review: reviews.length > 0 ? reviews[0] : null,
        items: items.map(item => ({
          ...item,
          product_name: item.product_name || item.db_product_name || 'สินค้า'
        }))
      }
    });
`;

code = code.replace(/res\.json\(\{\s*success: true,\s*order: \{\s*\.\.\.order,\s*items: items\.map\(item => \(\{\s*\.\.\.item,\s*product_name: item\.product_name \|\| item\.db_product_name \|\| 'สินค้า'\s*\}\)\)\s*\}\s*\}\);/g, replacement.trim());
fs.writeFileSync('c:/smartdeal/smart-deal-backend/src/server.js', code);
console.log('Replaced successfully');
