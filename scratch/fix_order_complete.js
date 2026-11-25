const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, '..', 'smart-deal-backend', 'src', 'server.js');
let code = fs.readFileSync(serverFile, 'utf8');

// Target endpoint block
const targetStart = "app.put('/api/orders/:orderId/complete', async (req, res) => {";
const targetEnd = "res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการยืนยันรับสินค้า' });\r\n  } finally {\r\n    connection.release();\r\n  }\r\n});";
const targetEndLF = "res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการยืนยันรับสินค้า' });\n  } finally {\n    connection.release();\n  }\n});";

const replacement = `app.put('/api/orders/:orderId/complete', async (req, res) => {
  const orderId = req.params.orderId;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.query('SELECT * FROM orders WHERE order_id = ? FOR UPDATE', [orderId]);
    if (orderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'ไม่พบคำสั่งซื้อ' });
    }

    const order = orderRows[0];
    if (order.order_status === 'completed') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'คำสั่งซื้อนี้เสร็จสมบูรณ์ไปแล้ว' });
    }

    const deliveryFee = parseFloat(order.delivery_fee || 0);

    // 1. อัปเดตสถานะคำสั่งซื้อและการจัดส่งเป็น completed (เสร็จสมบูรณ์ 100%)
    await connection.query('UPDATE orders SET order_status = "completed", delivered_at = NOW() WHERE order_id = ?', [orderId]);
    await connection.query('UPDATE deliveries SET status = "completed", completed_at = NOW() WHERE order_id = ?', [orderId]);

    // 2. คำนวณและโอนเงินเข้ากระเป๋าร้านค้าแยกตามแต่ละร้าน (Multi-vendor Escrow Release & หัก GP)
    const [feeRows] = await connection.query("SELECT setting_value FROM system_settings WHERE setting_key='platform_fee_percent'");
    const platform_fee = feeRows.length > 0 ? parseFloat(feeRows[0].setting_value) : 15;
    const fee_multiplier = 1 - (platform_fee / 100);

    // ดึงรายการสินค้าทั้งหมดในออเดอร์ เพื่อแยกยอดตามร้านค้าจริง
    const [orderItems] = await connection.query(\`
      SELECT oi.*, COALESCE(oi.shop_id, p.shop_id, ?) AS effective_shop_id
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.product_id
      WHERE oi.order_id = ?
    \`, [order.shop_id || 1, orderId]);

    // รวมยอดตามแต่ละร้านค้า
    const shopTotals = {};
    if (orderItems.length > 0) {
      orderItems.forEach(item => {
        const sId = String(item.effective_shop_id || order.shop_id || 1);
        const itemTotal = (parseFloat(item.price) || 0) * (item.quantity || 1);
        shopTotals[sId] = (shopTotals[sId] || 0) + itemTotal;
      });
    } else if (order.shop_id) {
      const gross = Math.max(0, parseFloat(order.total_amount || 0) - deliveryFee);
      shopTotals[String(order.shop_id)] = gross;
    }

    // โอนเงินเข้ากระเป๋าแต่ละร้านค้าตามยอดขายจริงหลังหัก GP
    for (const [sId, grossAmount] of Object.entries(shopTotals)) {
      if (grossAmount > 0) {
        const netAmount = parseFloat((grossAmount * fee_multiplier).toFixed(2));
        
        await connection.query(\`
          INSERT INTO shop_wallets (shop_id, balance) VALUES (?, ?)
          ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)
        \`, [sId, netAmount]);

        await connection.query(\`
          INSERT INTO wallet_transactions (user_type, target_id, order_id, amount, type, description)
          VALUES ('shop', ?, ?, ?, 'credit', ?)
        \`, [sId, orderId, netAmount, \`รายรับจากออเดอร์ #\${orderId} (หัก GP \${platform_fee}%)\`]);

        // ซิงค์ลง transactions ด้วย (เพื่อความเข้ากันได้กับ Navicat/Dashboard)
        try {
          await connection.query(\`
            INSERT INTO transactions (shop_id, amount, type, status, created_at)
            VALUES (?, ?, 'order_revenue', 'completed', NOW())
          \`, [sId, netAmount]);
        } catch(te) {}

        // แจ้งเตือนเจ้าของร้าน
        try {
          const [sRows] = await connection.query('SELECT owner_id, name FROM shops WHERE shop_id = ?', [sId]);
          if (sRows.length > 0 && sRows[0].owner_id) {
            await connection.query(
              'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
              [sRows[0].owner_id, \`💰 ลูกค้ายืนยันรับสินค้าแล้ว (#\${orderId})\`, \`คำสั่งซื้อ #\${orderId} เสร็จสมบูรณ์ ยอดเงินสุทธิ ฿\${netAmount} (หัก GP \${platform_fee}%) ได้เข้ากระเป๋าเงินร้านค้าของคุณเรียบร้อยแล้ว\`, String(orderId)]
            );
          }
        } catch(ne) {}
      }
    }

    // 3. ปล่อยเงินค่ารอบเข้ากระเป๋าไรเดอร์เมื่อลูกค้ายืนยันรับสินค้าแล้วเท่านั้น (Rider Escrow Release)
    const [delRows] = await connection.query('SELECT rider_id FROM deliveries WHERE order_id = ?', [orderId]);
    if (delRows.length > 0 && delRows[0].rider_id && deliveryFee > 0) {
      const riderId = delRows[0].rider_id;
      await connection.query(\`
        INSERT INTO rider_wallets (rider_id, balance) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)
      \`, [riderId, deliveryFee]);

      await connection.query(\`
        INSERT INTO wallet_transactions (user_type, target_id, order_id, amount, type, description)
        VALUES ('rider', ?, ?, ?, 'credit', ?)
      \`, [riderId, orderId, deliveryFee, \`ค่ารอบจัดส่งออเดอร์ #\${orderId} (ลูกค้ายืนยันรับสินค้าแล้ว)\`]);

      // แจ้งเตือนไรเดอร์
      try {
        const [rUser] = await connection.query('SELECT user_id FROM riders WHERE rider_id = ?', [riderId]);
        const riderUserId = rUser.length > 0 ? rUser[0].user_id : null;
        if (riderUserId) {
          await connection.query(
            'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
            [riderUserId, \`🛵 จัดส่งออเดอร์ #\${orderId} สำเร็จ\`, \`ลูกค้ายืนยันรับสินค้าแล้ว ค่ารอบ ฿\${deliveryFee} ได้เข้ากระเป๋าเงินของคุณเรียบร้อยแล้ว\`, String(orderId)]
          );
        }
      } catch(rne) {}
    }

    // 4. บันทึก / สร้างใบเสร็จใน receipts (ถ้ายังไม่มี)
    try {
      const d = order.created_at ? new Date(order.created_at) : new Date();
      const ymd = isNaN(d.getTime()) ? '20261012' : d.toISOString().slice(0, 10).replace(/-/g, '');
      const recNum = \`REC-\${ymd}-\${String(orderId).padStart(5, '0')}\`;
      await connection.query(\`
        INSERT IGNORE INTO receipts (order_id, receipt_number, issued_at)
        VALUES (?, ?, NOW())
      \`, [orderId, recNum]);
    } catch(re) {}

    // 5. แจ้งเตือนผู้ซื้อ (Buyer)
    try {
      if (order.user_id) {
        await connection.query(
          'INSERT INTO notifications (user_id, title, message, type, reference_id, is_read, created_at) VALUES (?, ?, ?, "order", ?, 0, NOW())',
          [order.user_id, \`🎉 คำสั่งซื้อ #\${orderId} เสร็จสมบูรณ์แล้ว\`, \`คุณได้ยืนยันการรับสินค้าเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ Smart Deal\`, String(orderId)]
        );
      }
    } catch(be) {}

    await connection.commit();
    res.json({ success: true, message: 'ยืนยันรับสินค้าและโอนเงินให้ร้านค้าสำเร็จ' });
  } catch (error) {
    await connection.rollback();
    console.error('Order Complete Error:', error);
    res.status(500).json({ success: false, message: error.message || 'เกิดข้อผิดพลาดในการยืนยันรับสินค้า' });
  } finally {
    connection.release();
  }
});`;

const startIdx = code.indexOf(targetStart);
let endIdx = -1;
let endLen = 0;

if (code.indexOf(targetEnd) !== -1) {
  endIdx = code.indexOf(targetEnd);
  endLen = targetEnd.length;
} else if (code.indexOf(targetEndLF) !== -1) {
  endIdx = code.indexOf(targetEndLF);
  endLen = targetEndLF.length;
}

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not locate endpoint bounds. startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

// Convert replacement to match file line endings
const formattedReplacement = code.includes('\r\n') 
  ? replacement.replace(/\r?\n/g, '\r\n')
  : replacement.replace(/\r\n/g, '\n');

code = code.substring(0, startIdx) + formattedReplacement + code.substring(endIdx + endLen);

// Also clean up the commented-out corrupted string around line 2516 if present
const corruptSearch = "const stats = { today_sales: (statsData[0].today_sales || 0)";
if (code.includes(corruptSearch)) {
  const cIdx = code.indexOf(corruptSearch);
  const before = code.lastIndexOf("`", cIdx);
  const after = code.indexOf("`]);", cIdx);
  if (before !== -1 && after !== -1) {
    const corruptSegment = code.substring(before, after + 4);
    code = code.replace(corruptSegment, "`รายรับจากออเดอร์ #${effectiveOrderId}`]);");
    console.log('Cleaned corrupted commented string.');
  }
}

fs.writeFileSync(serverFile, code, 'utf8');
console.log('Successfully updated server.js!');
