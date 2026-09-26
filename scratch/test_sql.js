const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'smart_deal_db'});
  const sql = `
      SELECT 
        orders.*, 
        shops.name AS shop_name,
        shops.image_url AS shop_image,
        del.status,
        u_rider.full_name AS rider_name,
        u_rider.phone AS rider_phone,
        u_customer.full_name AS customer_name,
        u_customer.phone AS customer_phone
      FROM orders
      LEFT JOIN shops ON orders.shop_id = shops.shop_id
      LEFT JOIN deliveries del ON orders.order_id = del.order_id
      LEFT JOIN riders r ON del.rider_id = r.rider_id
      LEFT JOIN users u_rider ON r.user_id = u_rider.user_id
      LEFT JOIN users u_customer ON orders.user_id = u_customer.user_id
      WHERE orders.user_id = 8
      ORDER BY orders.created_at DESC
  `;
  try {
    const [rows] = await conn.query(sql);
    console.log('Success, rows:', rows.length);
  } catch (e) {
    console.error('SQL Error:', e.message);
  }
  conn.end();
}
run().catch(console.error);
