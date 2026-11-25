const db = require('../../src/db');

async function seedHistory() {
  console.log('🚀 Starting Smart Deal Historical Data Seeding...');

  try {
    // 1. Fetch available references
    const [users] = await db.query('SELECT user_id FROM users WHERE role = "buyer" OR role = "user"');
    const [shops] = await db.query('SELECT shop_id FROM shops');
    const [products] = await db.query('SELECT product_id, shop_id, name, discount_price FROM products');
    const [riders] = await db.query('SELECT rider_id FROM riders');

    if (users.length === 0 || shops.length === 0 || products.length === 0) {
      console.log('❌ Missing base data (Users, Shops, or Products). Please seed them first.');
      process.exit(1);
    }

    // 2. Clear old order history to prevent messy dashboard
    console.log('🧹 Clearing old order history...');
    await db.query('DELETE FROM order_items');
    await db.query('DELETE FROM transactions');
    await db.query('DELETE FROM deliveries');
    await db.query('DELETE FROM orders');

    // 3. Generate 150 historical orders over the last 30 days
    console.log('📈 Generating 150 historical orders...');
    const now = new Date();
    let totalSales = 0;
    
    for (let i = 1; i <= 150; i++) {
      // Random date within last 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const randomDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000) - (Math.random() * 24 * 60 * 60 * 1000));
      
      const randomUser = users[Math.floor(Math.random() * users.length)].user_id;
      const randomShop = shops[Math.floor(Math.random() * shops.length)].shop_id;
      
      // Get products for this shop
      const shopProducts = products.filter(p => p.shop_id === randomShop);
      
      if (shopProducts.length === 0) continue;

      // Pick 1-3 random items for this order
      const numItems = Math.floor(Math.random() * 3) + 1;
      let subtotal = 0;
      const orderItemsToInsert = [];

      for (let j = 0; j < numItems; j++) {
        const p = shopProducts[Math.floor(Math.random() * shopProducts.length)];
        const qty = Math.floor(Math.random() * 2) + 1; // 1-2 items
        const price = parseFloat(p.discount_price);
        subtotal += price * qty;
        
        orderItemsToInsert.push({
          product_id: p.product_id,
          product_name: p.name,
          price: price,
          quantity: qty,
          shop_id: randomShop
        });
      }

      const deliveryFee = 20 + Math.floor(Math.random() * 40); // 20 - 59 Baht
      const discount = Math.random() > 0.8 ? 10 : 0; // 20% chance of 10 baht discount
      const totalAmount = subtotal + deliveryFee - discount;
      totalSales += totalAmount;

      // 4. Insert Order
      const [orderResult] = await db.query(
        `INSERT INTO orders (
          user_id, shop_id, subtotal, delivery_fee, discount, total_amount, 
          order_status, delivery_type, payment_method, receiver_name, receiver_phone, 
          shipping_address, created_at, order_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUser, randomShop, subtotal, deliveryFee, discount, totalAmount,
          'delivered', 'delivery', 'promptpay', 'ลูกค้า Smart Deal', '0800000000',
          'ที่อยู่จัดส่งจำลอง กรุงเทพมหานคร', randomDate, 'normal'
        ]
      );

      const orderId = orderResult.insertId;

      // 5. Insert Order Items
      for (const item of orderItemsToInsert) {
        await db.query(
          `INSERT INTO order_items (order_id, product_id, product_name, price, quantity, shop_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orderId, item.product_id, item.product_name, item.price, item.quantity, item.shop_id, randomDate]
        );
      }

      // 6. Insert Transaction for Shop Revenue (Subtotal minus commission if any, we'll just put subtotal)
      await db.query(
        `INSERT INTO transactions (shop_id, amount, type, status, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [randomShop, subtotal, 'order_revenue', 'completed', randomDate]
      );

      // 7. Randomly assign a delivery to some orders
      if (riders.length > 0) {
        const randomRider = riders[Math.floor(Math.random() * riders.length)].rider_id;
        await db.query(
          `INSERT INTO deliveries (order_id, rider_id, status, assigned_at, completed_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            orderId, randomRider, 'delivered', 
            new Date(randomDate.getTime() + 5 * 60000), // Assigned 5 mins later
            new Date(randomDate.getTime() + 30 * 60000) // Completed 30 mins later
          ]
        );
      }
    }

    console.log(`✅ Successfully generated historical data!`);
    console.log(`✅ Total Simulated Sales: ฿${totalSales.toFixed(2)}`);
    
    // Add a few active orders for today so they show up as "Recent Orders"
    console.log('📌 Adding a few active orders for today...');
    for (let i = 0; i < 3; i++) {
       const randomUser = users[Math.floor(Math.random() * users.length)].user_id;
       const randomShop = shops[Math.floor(Math.random() * shops.length)].shop_id;
       const shopProducts = products.filter(p => p.shop_id === randomShop);
       if(shopProducts.length === 0) continue;
       const p = shopProducts[0];
       const qty = 1;
       const price = parseFloat(p.discount_price);
       const subtotal = price;
       const totalAmount = subtotal + 30;

       const [orderResult] = await db.query(
        `INSERT INTO orders (
          user_id, shop_id, subtotal, delivery_fee, discount, total_amount, 
          order_status, delivery_type, payment_method, receiver_name, receiver_phone, 
          shipping_address, created_at, order_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          randomUser, randomShop, subtotal, 30, 0, totalAmount,
          'preparing', 'delivery', 'promptpay', 'ลูกค้า Smart Deal', '0800000000',
          'กรุงเทพมหานคร', 'normal'
        ]
      );
      const orderId = orderResult.insertId;
      await db.query(
          `INSERT INTO order_items (order_id, product_id, product_name, price, quantity, shop_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [orderId, p.product_id, p.name, p.discount_price, qty, randomShop]
        );
    }
    
    console.log('🎉 Done! Refresh the Admin Dashboard to see the new charts and statistics.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error seeding history:', e);
    process.exit(1);
  }
}

seedHistory();
