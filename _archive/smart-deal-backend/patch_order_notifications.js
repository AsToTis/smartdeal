const fs = require('fs');

function applyOrderNotifications() {
  const file = 'src/server.js';
  let content = fs.readFileSync(file, 'utf8');

  // 1. Update /api/orders/:orderId/status
  const statusOld = `    await db.execute(
      'UPDATE orders SET order_status = ? WHERE order_id = ?',
      [order_status, orderId]
    );

    res.json({ success: true, message: \`อัปเดตสถานะออเดอร์เป็น \${order_status} สำเร็จ\` });`;

  const statusNew = `    await db.execute(
      'UPDATE orders SET order_status = ? WHERE order_id = ?',
      [order_status, orderId]
    );

    // ส่งการแจ้งเตือนไปยังผู้ซื้อ (Buyer Notification)
    try {
      const [orderRows] = await db.execute('SELECT user_id, shop_id FROM orders WHERE order_id = ?', [orderId]);
      if (orderRows.length > 0) {
        const userId = orderRows[0].user_id;
        let notifTitle = '';
        let notifMsg = '';

        if (order_status === 'preparing') {
          notifTitle = \`👨‍🍳 ร้านค้ารับออเดอร์แล้ว (#\${orderId})\`;
          notifMsg = 'ร้านค้ากำลังเริ่มจัดเตรียมอาหาร/สินค้าของคุณแล้ว';
        } else if (order_status === 'ready') {
          notifTitle = \`📦 สินค้าจัดเตรียมเสร็จแล้ว (#\${orderId})\`;
          notifMsg = 'สินค้าของคุณจัดเตรียมเสร็จเรียบร้อยแล้ว พร้อมส่งมอบ';
        } else if (order_status === 'finding_rider') {
          notifTitle = \`🔍 กำลังค้นหาไรเดอร์ (#\${orderId})\`;
          notifMsg = 'ระบบกำลังค้นหาไรเดอร์เพื่อจัดส่งสินค้าของคุณ';
        } else if (order_status === 'delivering' || order_status === 'shipped') {
          notifTitle = \`🛵 สินค้ากำลังจัดส่ง (#\${orderId})\`;
          notifMsg = 'สินค้าของคุณอยู่ระหว่างการจัดส่งไปยังที่อยู่ของคุณ';
        } else if (order_status === 'completed') {
          notifTitle = \`✅ คำสั่งซื้อสำเร็จ (#\${orderId})\`;
          notifMsg = 'คำสั่งซื้อของคุณเสร็จสมบูรณ์เรียบร้อยแล้ว ขอบคุณที่ใช้บริการ SmartDeal';
        } else if (order_status === 'cancelled') {
          notifTitle = \`❌ คำสั่งซื้อถูกยกเลิก (#\${orderId})\`;
          notifMsg = 'คำสั่งซื้อของคุณถูกยกเลิกแล้ว';
        }

        if (notifTitle && userId) {
          await db.execute(
            'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
            [userId, notifTitle, notifMsg, String(orderId)]
          );
        }
      }
    } catch(notifErr) {
      console.error('Error inserting order status notification:', notifErr.message);
    }

    res.json({ success: true, message: \`อัปเดตสถานะออเดอร์เป็น \${order_status} สำเร็จ\` });`;

  if (content.includes(statusOld)) {
    content = content.replace(statusOld, statusNew);
    console.log('✅ 1. Patched PUT /api/orders/:orderId/status notification');
  } else {
    console.log('⚠️ 1. Could not match statusOld');
  }

  // 2. Update Rider Accept Job
  const riderAcceptOld = `      await connection.query(
        'INSERT INTO deliveries (order_id, rider_id, status, assigned_at) VALUES (?, ?, ?, NOW())',
        [orderId, rider_id, 'accepted']
      );
      await connection.query('UPDATE orders SET rider_id = ? WHERE order_id = ?', [rider_id, orderId]);
      await connection.commit();
      return res.json({ success: true, message: 'รับงานสำเร็จ' });`;

  const riderAcceptNew = `      await connection.query(
        'INSERT INTO deliveries (order_id, rider_id, status, assigned_at) VALUES (?, ?, ?, NOW())',
        [orderId, rider_id, 'accepted']
      );
      await connection.query('UPDATE orders SET rider_id = ? WHERE order_id = ?', [rider_id, orderId]);

      // Notify Buyer & Shop
      try {
        const [oRows] = await connection.query('SELECT user_id, shop_id FROM orders WHERE order_id = ?', [orderId]);
        if (oRows.length > 0) {
          const buyerId = oRows[0].user_id;
          const sId = oRows[0].shop_id;
          if (buyerId) {
            await connection.query(
              'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
              [buyerId, \`🛵 ไรเดอร์รับงานแล้ว (#\${orderId})\`, 'ไรเดอร์กำลังเดินทางไปรับสินค้าที่ร้านค้า', String(orderId)]
            );
          }
          if (sId) {
            const [sRows] = await connection.query('SELECT owner_id FROM shops WHERE shop_id = ?', [sId]);
            if (sRows.length > 0 && sRows[0].owner_id) {
              await connection.query(
                'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
                [sRows[0].owner_id, \`🛵 ไรเดอร์กำลังมารับสินค้า (#\${orderId})\`, \`มีไรเดอร์รับงานคำสั่งซื้อ #\${orderId} แล้ว กำลังเดินทางมาที่ร้าน\`, String(orderId)]
              );
            }
          }
        }
      } catch(ne) {}

      await connection.commit();
      return res.json({ success: true, message: 'รับงานสำเร็จ' });`;

  if (content.includes(riderAcceptOld)) {
    content = content.replace(riderAcceptOld, riderAcceptNew);
    console.log('✅ 2. Patched Rider Accept Job notification');
  } else {
    console.log('⚠️ 2. Could not match riderAcceptOld');
  }

  // 3. Update Rider Pickup
  const riderPickupOld = `    await connection.query(
      'UPDATE orders SET order_status = "delivering" WHERE order_id = ?',
      [orderId]
    );

    // Auto post delivery update & photo to Customer (Buyer <-> Rider channel)`;

  const riderPickupNew = `    await connection.query(
      'UPDATE orders SET order_status = "delivering" WHERE order_id = ?',
      [orderId]
    );

    // Notify Buyer
    try {
      const [oRows] = await connection.query('SELECT user_id FROM orders WHERE order_id = ?', [orderId]);
      if (oRows.length > 0 && oRows[0].user_id) {
        await connection.query(
          'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
          [oRows[0].user_id, \`🛵 ไรเดอร์รับสินค้าจากร้านแล้ว (#\${orderId})\`, 'ไรเดอร์ได้รับสินค้าเรียบร้อยแล้ว และกำลังเดินทางนำส่งให้คุณ', String(orderId)]
        );
      }
    } catch(ne) {}

    // Auto post delivery update & photo to Customer (Buyer <-> Rider channel)`;

  if (content.includes(riderPickupOld)) {
    content = content.replace(riderPickupOld, riderPickupNew);
    console.log('✅ 3. Patched Rider Pickup notification');
  } else {
    console.log('⚠️ 3. Could not match riderPickupOld');
  }

  // 4. Update Rider Complete Delivery
  const riderCompleteOld = `    await db.query('UPDATE orders SET order_status = "delivered", delivered_at = CURRENT_TIMESTAMP WHERE order_id = ?', [orderId]);

    // Auto post delivery proof message & photo to Customer (Buyer <-> Rider channel)`;

  const riderCompleteNew = `    await db.query('UPDATE orders SET order_status = "delivered", delivered_at = CURRENT_TIMESTAMP WHERE order_id = ?', [orderId]);

    // Notify Buyer & Shop
    try {
      const [oRows] = await db.query('SELECT user_id, shop_id FROM orders WHERE order_id = ?', [orderId]);
      if (oRows.length > 0) {
        const buyerId = oRows[0].user_id;
        const sId = oRows[0].shop_id;
        if (buyerId) {
          await db.query(
            'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
            [buyerId, \`🎉 ไรเดอร์จัดส่งสินค้าถึงที่หมายแล้ว (#\${orderId})\`, 'สินค้าส่งถึงที่หมายแล้ว กรุณาตรวจสอบและกดยืนยันการรับสินค้า', String(orderId)]
          );
        }
        if (sId) {
          const [sRows] = await db.query('SELECT owner_id FROM shops WHERE shop_id = ?', [sId]);
          if (sRows.length > 0 && sRows[0].owner_id) {
            await db.query(
              'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
              [sRows[0].owner_id, \`🎉 ไรเดอร์ส่งสินค้าเรียบร้อย (#\${orderId})\`, \`คำสั่งซื้อ #\${orderId} ถูกจัดส่งถึงลูกค้าเรียบร้อยแล้ว\`, String(orderId)]
            );
          }
        }
      }
    } catch(ne) {}

    // Auto post delivery proof message & photo to Customer (Buyer <-> Rider channel)`;

  if (content.includes(riderCompleteOld)) {
    content = content.replace(riderCompleteOld, riderCompleteNew);
    console.log('✅ 4. Patched Rider Complete Delivery notification');
  } else {
    console.log('⚠️ 4. Could not match riderCompleteOld');
  }

  // 5. Update POST /api/orders (New Order Created)
  const newOrderOld = `    await connection.commit();
    console.log(\`✅ สั่งซื้อและตัดสต็อกสินค้าสำเร็จสำหรับ Order ID: \${orderId}\`);

    res.json({ 
      success: true, 
      message: 'สั่งซื้อและตัดสต็อกสินค้าเรียบร้อยแล้ว', 
      order_id: orderId 
    });`;

  const newOrderNew = `    // Notify Shop Owner & Buyer
    try {
      if (shop_id) {
        const [sRows] = await connection.query('SELECT owner_id FROM shops WHERE shop_id = ?', [shop_id]);
        if (sRows.length > 0 && sRows[0].owner_id) {
          await connection.query(
            'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
            [sRows[0].owner_id, \`🛍️ มีคำสั่งซื้อใหม่เข้ามา! (#\${orderId})\`, \`คุณได้รับคำสั่งซื้อใหม่ #\${orderId} ยอดรวม ฿\${total_amount} กรุณาตรวจสอบและเตรียมสินค้า\`, String(orderId)]
          );
        }
      }
      if (user_id) {
        await connection.query(
          'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
          [user_id, \`📝 สร้างคำสั่งซื้อสำเร็จ (#\${orderId})\`, \`คำสั่งซื้อ #\${orderId} อยู่ระหว่างรอร้านค้ารับออเดอร์\`, String(orderId)]
        );
      }
    } catch(ne) {}

    await connection.commit();
    console.log(\`✅ สั่งซื้อและตัดสต็อกสินค้าสำเร็จสำหรับ Order ID: \${orderId}\`);

    res.json({ 
      success: true, 
      message: 'สั่งซื้อและตัดสต็อกสินค้าเรียบร้อยแล้ว', 
      order_id: orderId 
    });`;

  if (content.includes(newOrderOld)) {
    content = content.replace(newOrderOld, newOrderNew);
    console.log('✅ 5. Patched POST /api/orders notification');
  } else {
    console.log('⚠️ 5. Could not match newOrderOld');
  }

  // 6. Update PUT /api/orders/:orderId/complete (Customer Confirmed)
  const completeOrderOld = `      await connection.query(\`
        INSERT INTO wallet_transactions (user_type, target_id, order_id, amount, type, description)
        VALUES ('shop', ?, ?, ?, 'credit', ?)
      \`, [shopId, orderId, shopAmount, \`รายรับจากออเดอร์ #\${orderId}\`]);
    }`;

  const completeOrderNew = `      await connection.query(\`
        INSERT INTO wallet_transactions (user_type, target_id, order_id, amount, type, description)
        VALUES ('shop', ?, ?, ?, 'credit', ?)
      \`, [shopId, orderId, shopAmount, \`รายรับจากออเดอร์ #\${orderId}\`]);
    }

    // Notify Shop Owner
    try {
      if (shopId) {
        const [sRows] = await connection.query('SELECT owner_id FROM shops WHERE shop_id = ?', [shopId]);
        if (sRows.length > 0 && sRows[0].owner_id) {
          await connection.query(
            'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
            [sRows[0].owner_id, \`💰 ลูกค้ายืนยันรับสินค้าแล้ว (#\${orderId})\`, \`คำสั่งซื้อ #\${orderId} เสร็จสมบูรณ์ ยอดเงิน ฿\${shopAmount} ได้เข้ากระเป๋าเงินร้านค้าของคุณเรียบร้อยแล้ว\`, String(orderId)]
          );
        }
      }
    } catch(ne) {}`;

  if (content.includes(completeOrderOld)) {
    content = content.replace(completeOrderOld, completeOrderNew);
    console.log('✅ 6. Patched PUT /api/orders/:orderId/complete notification');
  } else {
    console.log('⚠️ 6. Could not match completeOrderOld');
  }

  fs.writeFileSync(file, content);
  console.log('🎉 Finished patching order notifications');
}

applyOrderNotifications();
