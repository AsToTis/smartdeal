const db = require('./smart-deal-backend/src/db');
(async () => {
  const [rows] = await db.query('SELECT product_id, name, image_url FROM products LIMIT 5');
  console.log('Products:', rows);
  
  const [shops] = await db.query('SELECT shop_id, name, image_url FROM shops LIMIT 5');
  console.log('Shops:', shops);
  
  process.exit(0);
})();
