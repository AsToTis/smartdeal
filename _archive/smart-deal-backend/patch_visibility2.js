const fs = require('fs');
const file = 'src/server.js';
let content = fs.readFileSync(file, 'utf8');

const oldProdByIdSql = `    const [rows] = await db.execute('SELECT * FROM products WHERE product_id = ? AND stock_quantity > 0 AND (deal_end_time IS NULL OR deal_end_time > NOW())', [id]);`;
const newProdByIdSql = `    const [rows] = await db.execute('SELECT * FROM products WHERE product_id = ? AND stock_quantity > 0', [id]);`;

if (content.includes(oldProdByIdSql)) {
    content = content.replace(oldProdByIdSql, newProdByIdSql);
    fs.writeFileSync(file, content);
    console.log("Patched /api/products/:id successfully");
} else {
    console.log("Could not find exact string for /api/products/:id");
}
