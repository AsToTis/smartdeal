const db = require('../../src/db');

async function addForeignKeys() {
  const queries = [
    // shops -> users (owner_id)
    `DELETE FROM shops WHERE owner_id IS NOT NULL AND owner_id NOT IN (SELECT user_id FROM users);`,
    `ALTER TABLE shops ADD CONSTRAINT fk_shops_users FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE;`,
    
    // shops -> categories (category_id)
    `UPDATE shops SET category_id = NULL WHERE category_id IS NOT NULL AND category_id NOT IN (SELECT category_id FROM categories);`,
    `ALTER TABLE shops ADD CONSTRAINT fk_shops_categories FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL ON UPDATE CASCADE;`,

    // order_items -> products (orphaned fix)
    `DELETE FROM order_items WHERE product_id IS NOT NULL AND product_id NOT IN (SELECT product_id FROM products);`,
    `ALTER TABLE order_items ADD CONSTRAINT fk_order_items_products FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE ON UPDATE CASCADE;`,

    // transactions -> shops (shop_id instead of order_id)
    `DELETE FROM transactions WHERE shop_id IS NOT NULL AND shop_id NOT IN (SELECT shop_id FROM shops);`,
    `ALTER TABLE transactions ADD CONSTRAINT fk_transactions_shops FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE ON UPDATE CASCADE;`,

    // order_messages -> orders (orphaned fix)
    `DELETE FROM order_messages WHERE order_id IS NOT NULL AND order_id NOT IN (SELECT order_id FROM orders);`,
    `ALTER TABLE order_messages ADD CONSTRAINT fk_order_messages_orders FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE;`,

    // auctions -> winner_user_id
    `UPDATE auctions SET winner_user_id = NULL WHERE winner_user_id IS NOT NULL AND winner_user_id NOT IN (SELECT user_id FROM users);`,
    `ALTER TABLE auctions ADD CONSTRAINT fk_auctions_winner FOREIGN KEY (winner_user_id) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE;`,

    // reviews -> orders (orphaned fix)
    `DELETE FROM reviews WHERE order_id IS NOT NULL AND order_id NOT IN (SELECT order_id FROM orders);`,
    `ALTER TABLE reviews ADD CONSTRAINT fk_reviews_orders FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE;`
  ];

  for (let q of queries) {
    try {
      console.log('Running:', q.length > 100 ? q.substring(0, 100) + '...' : q);
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
