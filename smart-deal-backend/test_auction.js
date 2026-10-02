const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({host:'localhost', user:'root', password:'', database:'smart_deal_db'});
  const shopId = 4; // Not sure if shopId is 4, let's get it from product
  const productId = 223;
  const [updatedProducts] = await conn.query('SELECT * FROM products WHERE product_id = ?', [productId]);
  const product = updatedProducts[0];
  console.log('product:', product.name, 'is_auction:', product.is_auction);
  const actualShopId = product.shop_id;
  const [existingAuctions] = await conn.query('SELECT auction_id FROM auctions WHERE shop_id = ? AND title = ? AND auction_status = "active"', [actualShopId, product.name]);
  console.log('existing:', existingAuctions);
  if (existingAuctions.length === 0) {
    const [shops] = await conn.query('SELECT name FROM shops WHERE shop_id = ?', [actualShopId]);
    const shopName = shops[0].name;
    await conn.query(`INSERT INTO auctions (title, description, image_url, shop_id, shop_name, start_price, current_bid, min_increment, end_time, auction_status, original_price, discount_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`, [product.name, product.description || '', product.image_url || '', actualShopId, shopName, product.discount_price || product.original_price || 0, product.discount_price || product.original_price || 0, 10, product.deal_end_time || new Date(Date.now() + 24*60*60*1000).toISOString().slice(0, 19).replace('T', ' '), product.original_price || 0, product.discount_percent || 0]);
    console.log('Inserted successfully!');
  } else {
    console.log('Already exists');
  }
  conn.end();
}
run().catch(console.error);
