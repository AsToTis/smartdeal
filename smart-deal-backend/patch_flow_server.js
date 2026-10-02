const fs = require('fs');

function patchOrderFlow() {
  const file = 'src/server.js';
  let content = fs.readFileSync(file, 'utf8');

  // 1. Fix Rider Jobs Query: Only show 'preparing' or 'ready' to riders
  // Currently: WHERE o.order_status IN ('finding_rider', 'ready', 'paid') 
  const riderJobsRegex1 = /WHERE o\.order_status IN \('finding_rider', 'ready', 'paid'\)/g;
  if (content.match(riderJobsRegex1)) {
    content = content.replace(riderJobsRegex1, "WHERE o.order_status IN ('preparing', 'ready')");
  }

  // Also in another place: WHERE o.order_status = 'finding_rider' AND o.delivery_type = 'delivery'
  const riderJobsRegex2 = /WHERE o\.order_status = 'finding_rider' AND o\.delivery_type = 'delivery'/g;
  if (content.match(riderJobsRegex2)) {
    content = content.replace(riderJobsRegex2, "WHERE o.order_status IN ('preparing', 'ready') AND o.delivery_type = 'delivery'");
  }

  // 2. Fix Rider Accept Job logic
  // Currently: await connection.query('UPDATE orders SET order_status = "delivering", rider_id = ? WHERE order_id = ?', [rider_id, orderId]);
  // It shouldn't change order_status to delivering yet. It should just assign rider_id.
  const acceptJobRegex = /await connection\.query\('UPDATE orders SET order_status = "delivering", rider_id = \? WHERE order_id = \?',\s*\[rider_id, orderId\]\);/g;
  if (content.match(acceptJobRegex)) {
    content = content.replace(acceptJobRegex, "await connection.query('UPDATE orders SET rider_id = ? WHERE order_id = ?', [rider_id, orderId]);");
  }

  // 3. Fix Customer Complete logic
  const customerCompleteRegex = /if \(order\.order_status === 'completed'\) \{\s*await connection\.rollback\(\);\s*return res\.status\(400\)\.json\(\{ success: false, message: 'คำสั่งซื้อนี้ถูกยืนยันรับไปแล้ว' \}\);\s*\}/s;
  const newCustomerComplete = `if (order.order_status === 'completed') {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'คำสั่งซื้อนี้ถูกยืนยันรับไปแล้ว' });
      }
      
      // Strict flow check
      if (order.delivery_type === 'delivery' && !['delivered', 'shipped'].includes(order.order_status)) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'ยังไม่สามารถยืนยันได้ (ต้องรอให้ไรเดอร์ส่งสินค้าเสร็จสิ้นก่อน)' });
      }
      if (order.delivery_type === 'pickup' && !['ready', 'ready_for_pickup'].includes(order.order_status)) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'ยังไม่สามารถยืนยันได้ (ร้านค้ายังเตรียมสินค้าไม่เสร็จ)' });
      }`;
  
  if (content.match(customerCompleteRegex) && !content.includes('ต้องรอให้ไรเดอร์ส่งสินค้าเสร็จสิ้นก่อน')) {
    content = content.replace(customerCompleteRegex, newCustomerComplete);
  }

  // 4. In shop order details, seller should be able to update to 'shipped' (handed to rider)
  const validStatusRegex = /const validStatuses = \['pending', 'paid', 'preparing', 'ready', 'finding_rider', 'delivering', 'completed', 'cancelled'\];/g;
  if (content.match(validStatusRegex)) {
    content = content.replace(validStatusRegex, "const validStatuses = ['pending', 'paid', 'preparing', 'ready', 'finding_rider', 'delivering', 'shipped', 'completed', 'cancelled'];");
  }

  fs.writeFileSync(file, content);
  console.log('Patched server.js for order flow');
}

patchOrderFlow();
