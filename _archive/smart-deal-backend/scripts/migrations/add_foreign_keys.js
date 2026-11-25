const db = require('../../src/db');

async function addForeignKeys() {
  const queries = [
    // shops -> users
    `ALTER TABLE shops ADD CONSTRAINT fk_shops_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    // products -> shops, categories
    `ALTER TABLE products ADD CONSTRAINT fk_products_shops FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    `ALTER TABLE products ADD CONSTRAINT fk_products_categories FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL ON UPDATE CASCADE;`,
    // orders -> users, shops, riders
    `ALTER TABLE orders ADD CONSTRAINT fk_orders_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    `ALTER TABLE orders ADD CONSTRAINT fk_orders_shops FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    `ALTER TABLE orders ADD CONSTRAINT fk_orders_riders FOREIGN KEY (rider_id) REFERENCES riders(rider_id) ON DELETE SET NULL ON UPDATE CASCADE;`,
    // order_items -> orders, products
    `ALTER TABLE order_items ADD CONSTRAINT fk_order_items_orders FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    `ALTER TABLE order_items ADD CONSTRAINT fk_order_items_products FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    // transactions -> orders
    `ALTER TABLE transactions ADD CONSTRAINT fk_transactions_orders FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    // payments -> orders
    `ALTER TABLE payments ADD CONSTRAINT fk_payments_orders FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    // receipts -> orders
    `ALTER TABLE receipts ADD CONSTRAINT fk_receipts_orders FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    // order_issues -> orders, users
    `ALTER TABLE order_issues ADD CONSTRAINT fk_order_issues_orders FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    `ALTER TABLE order_issues ADD CONSTRAINT fk_order_issues_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    // user_addresses -> users
    `ALTER TABLE user_addresses ADD CONSTRAINT fk_user_addresses_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    // notifications -> users
    `ALTER TABLE notifications ADD CONSTRAINT fk_notifications_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    // order_messages -> orders
    `ALTER TABLE order_messages ADD CONSTRAINT fk_order_messages_orders FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    // auctions -> products, shops
    `ALTER TABLE auctions ADD CONSTRAINT fk_auctions_products FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    `ALTER TABLE auctions ADD CONSTRAINT fk_auctions_shops FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    // auction_bids -> auctions, users
    `ALTER TABLE auction_bids ADD CONSTRAINT fk_auction_bids_auctions FOREIGN KEY (auction_id) REFERENCES auctions(auction_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    `ALTER TABLE auction_bids ADD CONSTRAINT fk_auction_bids_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    // rider_wallets -> riders
    `ALTER TABLE rider_wallets ADD CONSTRAINT fk_rider_wallets_riders FOREIGN KEY (rider_id) REFERENCES riders(rider_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    // shop_wallets -> shops
    `ALTER TABLE shop_wallets ADD CONSTRAINT fk_shop_wallets_shops FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    // user_points -> users
    `ALTER TABLE user_points ADD CONSTRAINT fk_user_points_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    // reviews -> orders, products, users
    `ALTER TABLE reviews ADD CONSTRAINT fk_reviews_orders FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    `ALTER TABLE reviews ADD CONSTRAINT fk_reviews_products FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    `ALTER TABLE reviews ADD CONSTRAINT fk_reviews_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
  ];

  for (let q of queries) {
    try {
      console.log('Running:', q.split(' ADD ')[1]);
      await db.query(q);
      console.log('✅ Success');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME' || e.code === 'ER_FK_DUP_NAME' || e.code === 'ER_CANNOT_ADD_FOREIGN') {
         console.log('⚠️ Failed or already exists:', e.message);
      } else {
         console.log('❌ Error:', e.message);
      }
    }
  }
  process.exit();
}

addForeignKeys();
