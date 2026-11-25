const fs = require('fs');
const file = 'src/server.js';
let content = fs.readFileSync(file, 'utf8');

const oldCronRegex = /const \[orders\] = await db\.query\(\s*"SELECT order_id, user_id FROM orders WHERE order_status = 'pending' AND created_at < NOW\(\) - INTERVAL 30 MINUTE"\s*\);/s;

const newCronQuery = `const [orders] = await db.query(
        "SELECT order_id, user_id, order_type FROM orders WHERE order_status = 'pending' AND created_at < NOW() - INTERVAL 30 MINUTE"
      );`;

if (content.match(oldCronRegex)) {
  content = content.replace(oldCronRegex, newCronQuery);
} else {
  console.log('Cron query not found');
}

const oldLoopRegex = /\/\/ 1\. Return stock\s*const \[items\] = await db\.query\("SELECT product_id, quantity FROM order_items WHERE order_id = \?", \[order\.order_id\]\);\s*for \(const item of items\) \{\s*if \(item\.product_id\) \{\s*await db\.query\(\s*"UPDATE products SET stock_quantity = stock_quantity \+ \? WHERE product_id = \?",\s*\[item\.quantity, item\.product_id\]\s*\);\s*\}\s*\}/s;

const newLoopLogic = `// 1. Return stock or Restart Auction
          const [items] = await db.query("SELECT product_id, quantity, product_name FROM order_items WHERE order_id = ?", [order.order_id]);
          
          if (order.order_type === 'auction') {
            for (const item of items) {
              const title = item.product_name;
              // Restart the auction
              await db.query(\`
                UPDATE auctions 
                SET auction_status = 'active', 
                    current_bid = start_price, 
                    winner_user_id = NULL,
                    end_time = DATE_ADD(NOW(), INTERVAL 30 MINUTE)
                WHERE title = ? AND auction_status = 'ended' AND winner_user_id = ?
                ORDER BY auction_id DESC LIMIT 1
              \`, [title, order.user_id]);
              
              const [aucRows] = await db.query("SELECT auction_id FROM auctions WHERE title = ? AND auction_status = 'active' ORDER BY auction_id DESC LIMIT 1", [title]);
              if (aucRows.length > 0) {
                await db.query("DELETE FROM auction_bids WHERE auction_id = ?", [aucRows[0].auction_id]);
              }
            }
          } else {
            for (const item of items) {
              if (item.product_id) {
                await db.query(
                  "UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?",
                  [item.quantity, item.product_id]
                );
              }
            }
          }`;

if (content.match(oldLoopRegex)) {
  content = content.replace(oldLoopRegex, newLoopLogic);
  fs.writeFileSync(file, content);
  console.log('Patched cron logic');
} else {
  console.log('Cron loop not found');
}
