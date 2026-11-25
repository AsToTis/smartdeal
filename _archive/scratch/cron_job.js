// Auto-cancel and refund orders pending > 30 mins
setInterval(async () => {
  try {
    const [orders] = await db.query(
      "SELECT order_id, user_id FROM orders WHERE order_status = 'pending' AND created_at < NOW() - INTERVAL 30 MINUTE"
    );

    if (orders.length > 0) {
      for (const order of orders) {
        // 1. Return stock
        const [items] = await db.query("SELECT product_id, quantity FROM order_items WHERE order_id = ?", [order.order_id]);
        for (const item of items) {
          if (item.product_id) {
            await db.query(
              "UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?",
              [item.quantity, item.product_id]
            );
          }
        }
        
        // 2. Notify customer
        const msg = 'ออเดอร์ของคุณถูกยกเลิกเนื่องจากร้านค้าไม่ตอบรับภายใน 30 นาที ระบบได้ลบออเดอร์และจะดำเนินการคืนเงินให้คุณ';
        await db.query(
          "INSERT INTO notifications (user_id, title, message) VALUES (?, 'ยกเลิกออเดอร์ (ร้านไม่ตอบรับ)', ?)",
          [order.user_id, msg]
        );
        
        // 3. Delete order (cascades to order_items)
        await db.query("DELETE FROM deliveries WHERE order_id = ?", [order.order_id]);
        await db.query("DELETE FROM orders WHERE order_id = ?", [order.order_id]);
        
        console.log(`🗑️ ลบออเดอร์ที่หมดเวลา (30 นาที) Order ID: ${order.order_id}`);
      }
    }
  } catch (error) {
    console.error('Auto-cancel cron error:', error.message);
  }
}, 60 * 1000); // Check every 1 minute
