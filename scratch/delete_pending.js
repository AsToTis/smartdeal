const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'smart_deal_db'});
  
  try {
    // 1. Get pending orders
    const [orders] = await conn.query("SELECT order_id FROM orders WHERE order_status = 'pending'");
    console.log(`Found ${orders.length} pending orders to delete.`);
    
    if (orders.length > 0) {
      const orderIds = orders.map(o => o.order_id);
      
      // Return stock
      for (const oId of orderIds) {
        const [items] = await conn.query("SELECT product_id, quantity FROM order_items WHERE order_id = ?", [oId]);
        for (const item of items) {
          if (item.product_id) {
            await conn.query("UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?", [item.quantity, item.product_id]);
          }
        }
      }
      
      // Delete deliveries just in case
      await conn.query("DELETE FROM deliveries WHERE order_id IN (?)", [orderIds]);
      
      // Delete from order_items
      await conn.query("DELETE FROM order_items WHERE order_id IN (?)", [orderIds]);
      
      // Delete from orders
      await conn.query("DELETE FROM orders WHERE order_id IN (?)", [orderIds]);
      
      console.log('Deleted successfully.');
    }
  } catch (e) {
    console.error(e);
  }
  conn.end();
}
run();
