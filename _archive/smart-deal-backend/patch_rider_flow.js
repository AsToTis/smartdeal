const fs = require('fs');

function patchRiderFlow() {
  const file = 'src/server.js';
  let content = fs.readFileSync(file, 'utf8');

  // Fix the condition in accepting job
  const acceptCondRegex = /!\['finding_rider', 'ready', 'paid'\]\.includes\(orders\[0\]\.order_status\)/g;
  if (content.match(acceptCondRegex)) {
    content = content.replace(acceptCondRegex, "!['preparing', 'ready'].includes(orders[0].order_status)");
  }

  // Update order_status when rider updates delivery status
  const updateDeliveryStatusRegex = /const \[result\] = await connection\.query\('UPDATE deliveries SET status = \? WHERE order_id = \? AND rider_id = \? AND status <> "delivered"', \[status, orderId, rider_id\]\);\s*if \(result\.affectedRows === 0\) \{\s*await connection\.rollback\(\);\s*return res\.status\(404\)\.json\(\{ success: false, message: 'ไม่พบงานที่ไรเดอร์รับไว้' \}\);\s*\}\s*await connection\.commit\(\);/s;
  
  const newUpdateLogic = `const [result] = await connection.query('UPDATE deliveries SET status = ? WHERE order_id = ? AND rider_id = ? AND status <> "delivered"', [status, orderId, rider_id]);
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'ไม่พบงานที่ไรเดอร์รับไว้' });
    }
    
    // Sync with order_status
    if (status === 'picked_up' || status === 'delivering') {
      await connection.query('UPDATE orders SET order_status = "delivering" WHERE order_id = ?', [orderId]);
    } else if (status === 'delivered') {
      await connection.query('UPDATE orders SET order_status = "delivered" WHERE order_id = ?', [orderId]);
    }
    
    await connection.commit();`;
    
  if (content.match(updateDeliveryStatusRegex)) {
    content = content.replace(updateDeliveryStatusRegex, newUpdateLogic);
  }

  // Also patch the POST /api/rider/deliveries/:order_id/complete
  const completeRiderRegex = /await db\.query\('UPDATE orders SET order_status = "shipped", delivered_at = CURRENT_TIMESTAMP WHERE order_id = \?', \[orderId\]\);/g;
  if (content.match(completeRiderRegex)) {
    content = content.replace(completeRiderRegex, "await db.query('UPDATE orders SET order_status = \"delivered\", delivered_at = CURRENT_TIMESTAMP WHERE order_id = ?', [orderId]);");
  }

  fs.writeFileSync(file, content);
  console.log('Patched rider flow');
}

patchRiderFlow();
