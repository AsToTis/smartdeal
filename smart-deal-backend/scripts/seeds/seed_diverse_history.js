const db = require('../../src/db');

async function seedDiverseHistory() {
  console.log('🚀 Starting Diverse Historical Data Seeding...');

  try {
    const [users] = await db.query('SELECT user_id FROM users WHERE role = "buyer" OR role = "user"');
    const [shops] = await db.query('SELECT shop_id, category_id, name FROM shops');
    const [riders] = await db.query('SELECT rider_id FROM riders');

    if (users.length === 0 || shops.length === 0) {
      console.log('❌ Missing base data (Users or Shops).');
      process.exit(1);
    }

    console.log('🧹 Clearing old history and old products...');
    await db.query('DELETE FROM order_items');
    await db.query('DELETE FROM transactions');
    await db.query('DELETE FROM deliveries');
    await db.query('DELETE FROM orders');
    // Only delete products that are expired (historical ones from our previous runs if any)
    await db.query('DELETE FROM products WHERE expiry_time < NOW()');

    // 1. Generate 100 Historical Products (expired) to simulate daily rotating items
    console.log('📦 Generating 100 historical expired products for diverse history...');
    
    // Dictionaries for generating diverse product names based on category
    // Category 1: เบเกอรี่, 2: อาหารมื้อหลัก, 3: ผลไม้, 4: เครื่องดื่ม, 5: ขนมหวาน
    const foodPrefixes = ['ข้าวกล่อง', 'เซ็ต', 'เมนูพิเศษ:', 'ชุดประหยัด:', 'กล่องสุ่ม', 'ลดล้างสต็อก:'];
    const shopMenus = {
      1: ['ครัวซองต์ช็อกโกแลต', 'พายแอปเปิ้ล', 'ขนมปังกระเทียมชีส', 'ทาร์ตไข่', 'มัฟฟินบลูเบอร์รี่', 'แซนด์วิชทูน่า', 'ขนมปังเนยสด', 'บาแกตต์ฝรั่งเศส', 'เดนิชผลไม้รวม', 'โรลวานิลลา'],
      2: ['เบนโตะไก่เทอริยากิ', 'ซูชิรวมเซ็ต B', 'ยากิโซบะ', 'ข้าวหมูทอดทงคัตสึ', 'ข้าวผัดกะเพราเนื้อโคขุน', 'ต้มยำทะเลน้ำข้น', 'สลัดโรลอกไก่', 'สเต็กหมูพริกไทยดำ', 'ข้าวผัดปู', 'สปาเก็ตตี้คาโบนาร่า', 'สลัดแซลมอนรมควัน', 'ยำรวมมิตรทะเล', 'ข้าวหมูกรอบไข่ต้ม', 'ไก่ย่างสมุนไพรครึ่งตัว'],
      3: ['เซ็ตแอปเปิ้ลฟูจิ', 'องุ่นแดงไร้เมล็ด', 'สตรอว์เบอร์รีแพ็คเกรดรอง', 'แตงโมหั่นชิ้น', 'เมล่อนญี่ปุ่นหั่นพร้อมทาน', 'กล้วยหอมทองแพ็ค', 'มะม่วงสุก', 'สับปะรดภูแล', 'เซ็ตผลไม้รวมวิตามิน', 'ฝรั่งกิมจู'],
      4: ['อเมริกาโน่เย็น', 'ชาไทยนมสด', 'มัทฉะกรีนที', 'ช็อกโกแลตเย็น', 'น้ำส้มคั้นสด', 'สมูทตี้สตรอว์เบอร์รี', 'คาปูชิโน่เย็น', 'ชาพีช', 'น้ำมะพร้าวปั่น', 'ชาเขียวมะลิ'],
      5: ['ชูครีมวานิลลา', 'บราวนี่มัทฉะ', 'ชีสเค้กสตรอว์เบอร์รี', 'พุดดิ้งนมสด', 'มาการองเซ็ต 6 ชิ้น', 'ทาร์ตเลมอน', 'เค้กช็อกโกแลตหน้านิ่ม', 'ไดฟุกุสตรอว์เบอร์รี', 'ไอศกรีมเจลาโต้', 'เครปเค้กชาไทย']
    };

    const historicalProducts = [];
    const now = new Date();

    for (const shop of shops) {
      // Create 15-20 past products for each shop
      const numPastProducts = 15 + Math.floor(Math.random() * 6);
      const catId = shop.category_id || 2;
      const menuList = shopMenus[catId] || shopMenus[2];

      for (let i = 0; i < numPastProducts; i++) {
        // Random past date for expiry
        const daysAgo = 1 + Math.floor(Math.random() * 29); // 1-30 days ago
        const pastExpiry = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000) + (Math.random() * 12 * 60 * 60 * 1000));
        
        const prefix = foodPrefixes[Math.floor(Math.random() * foodPrefixes.length)];
        const baseName = menuList[Math.floor(Math.random() * menuList.length)];
        const productName = Math.random() > 0.5 ? `${prefix} ${baseName}` : baseName;
        
        const originalPrice = 50 + Math.floor(Math.random() * 300);
        const discountPercent = 40 + Math.floor(Math.random() * 40); // 40-80% discount
        const discountPrice = Math.floor(originalPrice * (1 - (discountPercent/100)));

        const [res] = await db.query(
          `INSERT INTO products (
            shop_id, category_id, name, original_price, discount_price, 
            discount_percent, expiry_text, image_url, stock_quantity, expiry_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            shop.shop_id, catId, productName, originalPrice, discountPrice, 
            discountPercent, 'หมดอายุแล้ว', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400', 
            0, pastExpiry // stock 0, expired in the past
          ]
        );
        
        historicalProducts.push({
          product_id: res.insertId,
          shop_id: shop.shop_id,
          name: productName,
          discount_price: discountPrice,
          expiry_time: pastExpiry
        });
      }
    }

    // 2. Generate 150 historical orders over the last 30 days
    console.log('📈 Generating 150 historical orders using diverse past products...');
    let totalSales = 0;
    
    for (let i = 1; i <= 150; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)].user_id;
      const randomShop = shops[Math.floor(Math.random() * shops.length)].shop_id;
      
      // Get historical products ONLY for this shop
      const shopPastProducts = historicalProducts.filter(p => p.shop_id === randomShop);
      if (shopPastProducts.length === 0) continue;

      // Pick a random historical product to base the order date on
      const mainProduct = shopPastProducts[Math.floor(Math.random() * shopPastProducts.length)];
      // The order must happen slightly before the expiry time of the product
      const orderDate = new Date(mainProduct.expiry_time.getTime() - (Math.random() * 4 * 60 * 60 * 1000)); 

      // Pick 1-3 items
      const numItems = Math.floor(Math.random() * 3) + 1;
      let subtotal = 0;
      const orderItemsToInsert = [];

      // We use mainProduct as first item to ensure dates align
      subtotal += mainProduct.discount_price * 1;
      orderItemsToInsert.push({
        product_id: mainProduct.product_id,
        product_name: mainProduct.name,
        price: mainProduct.discount_price,
        quantity: 1,
        shop_id: randomShop
      });

      for (let j = 1; j < numItems; j++) {
        const p = shopPastProducts[Math.floor(Math.random() * shopPastProducts.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        subtotal += p.discount_price * qty;
        orderItemsToInsert.push({
          product_id: p.product_id,
          product_name: p.name,
          price: p.discount_price,
          quantity: qty,
          shop_id: randomShop
        });
      }

      const deliveryFee = 20 + Math.floor(Math.random() * 40);
      const discount = Math.random() > 0.8 ? 10 : 0; 
      const totalAmount = subtotal + deliveryFee - discount;
      totalSales += totalAmount;

      const [orderResult] = await db.query(
        `INSERT INTO orders (
          user_id, shop_id, subtotal, delivery_fee, discount, total_amount, 
          order_status, delivery_type, payment_method, receiver_name, receiver_phone, 
          shipping_address, created_at, order_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUser, randomShop, subtotal, deliveryFee, discount, totalAmount,
          'delivered', 'delivery', 'promptpay', 'ลูกค้า Smart Deal', '0800000000',
          'กรุงเทพมหานคร', orderDate, 'normal'
        ]
      );

      const orderId = orderResult.insertId;

      for (const item of orderItemsToInsert) {
        await db.query(
          `INSERT INTO order_items (order_id, product_id, product_name, price, quantity, shop_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orderId, item.product_id, item.product_name, item.price, item.quantity, item.shop_id, orderDate]
        );
      }

      await db.query(
        `INSERT INTO transactions (shop_id, amount, type, status, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [randomShop, subtotal, 'order_revenue', 'completed', orderDate]
      );

      if (riders.length > 0) {
        const randomRider = riders[Math.floor(Math.random() * riders.length)].rider_id;
        await db.query(
          `INSERT INTO deliveries (order_id, rider_id, status, assigned_at, completed_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            orderId, randomRider, 'delivered', 
            new Date(orderDate.getTime() + 5 * 60000), 
            new Date(orderDate.getTime() + 30 * 60000)
          ]
        );
      }
    }

    console.log(`✅ Successfully generated DIVERSE historical data!`);
    console.log(`✅ Total Simulated Sales: ฿${totalSales.toFixed(2)}`);
    
    // Add a few active orders for today from CURRENT active products
    console.log('📌 Adding a few active orders for today from active products...');
    const [activeProducts] = await db.query('SELECT product_id, shop_id, name, discount_price FROM products WHERE expiry_time > NOW()');
    
    for (let i = 0; i < 5; i++) {
       const randomUser = users[Math.floor(Math.random() * users.length)].user_id;
       if(activeProducts.length === 0) break;
       const p = activeProducts[Math.floor(Math.random() * activeProducts.length)];
       const randomShop = p.shop_id;
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
          'preparing', 'delivery', 'promptpay', 'ลูกค้า', '0800000000',
          'กทม.', 'normal'
        ]
      );
      const orderId = orderResult.insertId;
      await db.query(
          `INSERT INTO order_items (order_id, product_id, product_name, price, quantity, shop_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [orderId, p.product_id, p.name, price, qty, randomShop]
        );
    }
    
    console.log('🎉 Done! Diverse data seeded perfectly.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error seeding history:', e);
    process.exit(1);
  }
}

seedDiverseHistory();
