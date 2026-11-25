const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src', 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// 1. Add alter table for shop_statuses if not present
if (!content.includes('ALTER TABLE orders ADD COLUMN shop_statuses')) {
  const alterTarget = `try { await db.execute('ALTER TABLE deliveries ADD COLUMN pickup_at DATETIME NULL'); } catch(e) {}`;
  const alterReplacement = `try { await db.execute('ALTER TABLE deliveries ADD COLUMN pickup_at DATETIME NULL'); } catch(e) {}\n    try { await db.execute('ALTER TABLE orders ADD COLUMN shop_statuses LONGTEXT NULL'); } catch(e) {}`;
  content = content.replace(alterTarget, alterReplacement);
}

// 2. Patch GET /api/orders/user/:userId to include shops array with per-shop statuses
const oldUserOrdersMap = `    const formattedOrders = orders.map((order) => {
      const items = itemsByOrderId[order.order_id] || [];
      const primaryItem = items && items.length > 0 ? items[0] : null;
      const displayTitle = primaryItem ? (primaryItem.product_name || primaryItem.db_product_name || order.shop_name) : (order.shop_name || 'ร้านค้า');
      const displayImage = (primaryItem && primaryItem.product_image) || order.shop_image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';

      return {
        ...order,
        items: items.map(item => ({
          ...item,
          product_name: item.product_name || item.db_product_name || 'สินค้า',
          shop_name: item.item_shop_name || order.shop_name || 'ร้านค้า'
        })),
        item_count: items.reduce((acc, i) => acc + (i.quantity || 1), 0),
        display_title: displayTitle,
        display_image: displayImage,
        shop_name: order.shop_name || 'ร้านค้าทั่วไป',
        status_text: statusThai[order.order_status] || order.order_status,
        delivery_type_text: deliveryTypeThai[order.delivery_type] || order.delivery_type
      };
    });`;

const newUserOrdersMap = `    const formattedOrders = orders.map((order) => {
      const items = itemsByOrderId[order.order_id] || [];
      const primaryItem = items && items.length > 0 ? items[0] : null;
      const displayTitle = primaryItem ? (primaryItem.product_name || primaryItem.db_product_name || order.shop_name) : (order.shop_name || 'ร้านค้า');
      const displayImage = (primaryItem && primaryItem.product_image) || order.shop_image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';

      // Parse shop_statuses & pickup_proofs
      let parsedShopStatuses = {};
      if (order.shop_statuses) {
        try { parsedShopStatuses = typeof order.shop_statuses === 'string' ? JSON.parse(order.shop_statuses) : order.shop_statuses; } catch(e) {}
      }
      let parsedPickupProofs = {};
      if (order.pickup_proofs) {
        try { parsedPickupProofs = typeof order.pickup_proofs === 'string' ? JSON.parse(order.pickup_proofs) : order.pickup_proofs; } catch(e) {}
      }

      // Group distinct shops in this order
      const shopMap = {};
      items.forEach(it => {
        const sid = String(it.product_shop_id || it.shop_id || order.shop_id || '1');
        const sname = it.item_shop_name || order.shop_name || 'ร้านค้า';
        const simg = it.product_image || order.shop_image || '';
        if (!shopMap[sid]) {
          shopMap[sid] = {
            shop_id: Number(sid),
            shop_name: sname,
            shop_image: simg,
            items: []
          };
        }
        shopMap[sid].items.push(it);
      });

      const shopsList = Object.values(shopMap).map(s => {
        const sid = String(s.shop_id);
        const isPickedUp = !!(parsedPickupProofs[sid] && parsedPickupProofs[sid].proof_image);
        let sStatus = parsedShopStatuses[sid] || (['pending', 'paid'].includes(order.order_status) ? 'preparing' : order.order_status);
        if (isPickedUp) {
          sStatus = 'picked_up';
        }
        return {
          ...s,
          shop_status: sStatus,
          is_picked_up: isPickedUp,
          pickup_proof_image: parsedPickupProofs[sid]?.proof_image || null,
          items_count: s.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
        };
      });

      return {
        ...order,
        shops: shopsList,
        shop_statuses: parsedShopStatuses,
        items: items.map(item => ({
          ...item,
          product_name: item.product_name || item.db_product_name || 'สินค้า',
          shop_name: item.item_shop_name || order.shop_name || 'ร้านค้า'
        })),
        item_count: items.reduce((acc, i) => acc + (i.quantity || 1), 0),
        display_title: displayTitle,
        display_image: displayImage,
        shop_name: order.shop_name || 'ร้านค้าทั่วไป',
        status_text: statusThai[order.order_status] || order.order_status,
        delivery_type_text: deliveryTypeThai[order.delivery_type] || order.delivery_type
      };
    });`;

if (content.includes(oldUserOrdersMap)) {
  content = content.replace(oldUserOrdersMap, newUserOrdersMap);
}

// 3. Patch GET /api/orders/:orderId to filter by shop_id if passed, and calculate isolated totals for seller
const oldSingleOrderQuery = `    const order = orders[0];
    const [items] = await db.execute(
      \`SELECT oi.*, p.name AS db_product_name, p.shop_id AS product_shop_id,
              COALESCE(p.image_url, (SELECT image_url FROM auctions WHERE title COLLATE utf8mb4_unicode_ci = oi.product_name COLLATE utf8mb4_unicode_ci LIMIT 1)) AS product_image,
              COALESCE(s_p.name, s_oi.name, (SELECT name FROM shops WHERE shop_id = p.shop_id), (SELECT name FROM shops WHERE shop_id = oi.shop_id), '') AS item_shop_name
         FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.product_id
       LEFT JOIN shops s_p ON p.shop_id = s_p.shop_id
       LEFT JOIN shops s_oi ON oi.shop_id = s_oi.shop_id
       WHERE oi.order_id = ?\`,
      [orderId]
    );

    const [reviews] = await db.execute('SELECT rating, comment, created_at FROM reviews WHERE order_id = ? LIMIT 1', [orderId]);
    res.json({
      success: true,
      order: {
        ...order,
        review: reviews.length > 0 ? reviews[0] : null,
        items: items.map(item => ({
          ...item,
          product_name: item.product_name || item.db_product_name || 'สินค้า',
          shop_name: item.item_shop_name || order.shop_name || 'ร้านค้า'
        }))
      }
    });`;

const newSingleOrderQuery = `    const order = orders[0];
    const requestedShopId = req.query.shop_id ? String(req.query.shop_id) : null;

    const [items] = await db.execute(
      \`SELECT oi.*, p.name AS db_product_name, p.shop_id AS product_shop_id,
              COALESCE(p.image_url, (SELECT image_url FROM auctions WHERE title COLLATE utf8mb4_unicode_ci = oi.product_name COLLATE utf8mb4_unicode_ci LIMIT 1)) AS product_image,
              COALESCE(s_p.name, s_oi.name, (SELECT name FROM shops WHERE shop_id = p.shop_id), (SELECT name FROM shops WHERE shop_id = oi.shop_id), '') AS item_shop_name
         FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.product_id
       LEFT JOIN shops s_p ON p.shop_id = s_p.shop_id
       LEFT JOIN shops s_oi ON oi.shop_id = s_oi.shop_id
       WHERE oi.order_id = ?\`,
      [orderId]
    );

    let parsedShopStatuses = {};
    if (order.shop_statuses) {
      try { parsedShopStatuses = typeof order.shop_statuses === 'string' ? JSON.parse(order.shop_statuses) : order.shop_statuses; } catch(e) {}
    }
    let parsedPickupProofs = {};
    if (order.pickup_proofs) {
      try { parsedPickupProofs = typeof order.pickup_proofs === 'string' ? JSON.parse(order.pickup_proofs) : order.pickup_proofs; } catch(e) {}
    }

    // Build distinct shops array
    const shopMap = {};
    items.forEach(it => {
      const sid = String(it.product_shop_id || it.shop_id || order.shop_id || '1');
      const sname = it.item_shop_name || order.shop_name || 'ร้านค้า';
      const simg = it.product_image || order.shop_image || '';
      if (!shopMap[sid]) {
        shopMap[sid] = {
          shop_id: Number(sid),
          shop_name: sname,
          shop_image: simg,
          items: []
        };
      }
      shopMap[sid].items.push(it);
    });

    const shopsList = Object.values(shopMap).map(s => {
      const sid = String(s.shop_id);
      const isPickedUp = !!(parsedPickupProofs[sid] && parsedPickupProofs[sid].proof_image);
      let sStatus = parsedShopStatuses[sid] || (['pending', 'paid'].includes(order.order_status) ? 'preparing' : order.order_status);
      if (isPickedUp) sStatus = 'picked_up';
      return {
        ...s,
        shop_status: sStatus,
        is_picked_up: isPickedUp,
        pickup_proof_image: parsedPickupProofs[sid]?.proof_image || null,
        items_count: s.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
      };
    });

    // If requested by seller for specific shop_id
    let itemsToReturn = items;
    let effectiveSubtotal = Number(order.subtotal || order.total_amount || 0);
    let effectiveTotal = Number(order.total_amount || 0);
    let effectiveStatus = order.order_status;

    if (requestedShopId) {
      const myShopItems = items.filter(it => 
        String(it.product_shop_id || it.shop_id) === requestedShopId ||
        (!it.shop_id && !it.product_shop_id && String(order.shop_id) === requestedShopId)
      );
      if (myShopItems.length > 0) {
        itemsToReturn = myShopItems;
        const mySubtotal = myShopItems.reduce((acc, it) => acc + (parseFloat(it.price || 0) * (it.quantity || 1)), 0);
        effectiveSubtotal = mySubtotal;
        effectiveTotal = mySubtotal;
      }
      if (parsedShopStatuses[requestedShopId]) {
        effectiveStatus = parsedShopStatuses[requestedShopId];
      } else if (['pending', 'paid'].includes(order.order_status)) {
        effectiveStatus = 'preparing';
      }
    }

    const [reviews] = await db.execute('SELECT rating, comment, created_at FROM reviews WHERE order_id = ? LIMIT 1', [orderId]);
    res.json({
      success: true,
      order: {
        ...order,
        subtotal: effectiveSubtotal,
        total_amount: effectiveTotal,
        order_status: effectiveStatus,
        shops: shopsList,
        shop_statuses: parsedShopStatuses,
        review: reviews.length > 0 ? reviews[0] : null,
        items: itemsToReturn.map(item => ({
          ...item,
          product_name: item.product_name || item.db_product_name || 'สินค้า',
          shop_name: item.item_shop_name || order.shop_name || 'ร้านค้า'
        }))
      }
    });`;

if (content.includes(oldSingleOrderQuery)) {
  content = content.replace(oldSingleOrderQuery, newSingleOrderQuery);
}

// 4. Patch GET /api/shops/:shopId/orders to isolate items, subtotal, and status
const oldShopOrdersFormat = `    const formattedOrders = orders.map(order => {
      const allOrderItems = itemsByOrderId[order.order_id] || [];
      const myShopItems = allOrderItems.filter(item => 
        Number(item.product_shop_id || item.shop_id) === Number(shopId) || 
        (!item.shop_id && !item.product_shop_id && Number(order.shop_id) === Number(shopId))
      );
      const itemsToDisplay = myShopItems.length > 0 ? myShopItems : allOrderItems;

      let shopPickupProof = null;
      if (order.pickup_proofs) {
        try {
          const proofs = typeof order.pickup_proofs === 'string' ? JSON.parse(order.pickup_proofs) : order.pickup_proofs;
          if (proofs && proofs[String(shopId)]) {
            shopPickupProof = proofs[String(shopId)].proof_image || null;
          }
        } catch(e) {}
      } else if (Number(order.shop_id) === Number(shopId)) {
        shopPickupProof = order.pickup_proof_image || null;
      }

      return {
        ...order,
        pickup_proof_image: shopPickupProof,
        items: itemsToDisplay.map(item => ({
          ...item,
          product_name: item.product_name || item.db_product_name || 'สินค้า',
          shop_name: item.item_shop_name || order.shop_name || 'ร้านค้า'
        })),
        all_items: allOrderItems.map(item => ({
          ...item,
          product_name: item.product_name || item.db_product_name || 'สินค้า',
          shop_name: item.item_shop_name || order.shop_name || 'ร้านค้า'
        })),
        all_items_count: allOrderItems.length,
        my_items_count: myShopItems.length
      };
    });`;

const newShopOrdersFormat = `    const formattedOrders = orders.map(order => {
      const allOrderItems = itemsByOrderId[order.order_id] || [];
      const myShopItems = allOrderItems.filter(item => 
        Number(item.product_shop_id || item.shop_id) === Number(shopId) || 
        (!item.shop_id && !item.product_shop_id && Number(order.shop_id) === Number(shopId))
      );
      const itemsToDisplay = myShopItems.length > 0 ? myShopItems : allOrderItems;

      // Calculate isolated seller subtotal & total
      const myShopSubtotal = itemsToDisplay.reduce((acc, it) => acc + (parseFloat(it.price || 0) * (it.quantity || 1)), 0);

      let shopPickupProof = null;
      if (order.pickup_proofs) {
        try {
          const proofs = typeof order.pickup_proofs === 'string' ? JSON.parse(order.pickup_proofs) : order.pickup_proofs;
          if (proofs && proofs[String(shopId)]) {
            shopPickupProof = proofs[String(shopId)].proof_image || null;
          }
        } catch(e) {}
      } else if (Number(order.shop_id) === Number(shopId)) {
        shopPickupProof = order.pickup_proof_image || null;
      }

      // Per-shop status
      let parsedShopStatuses = {};
      if (order.shop_statuses) {
        try { parsedShopStatuses = typeof order.shop_statuses === 'string' ? JSON.parse(order.shop_statuses) : order.shop_statuses; } catch(e) {}
      }

      let effectiveShopStatus = parsedShopStatuses[String(shopId)];
      if (!effectiveShopStatus) {
        if (['pending', 'paid'].includes(order.order_status)) {
          effectiveShopStatus = 'preparing';
        } else {
          effectiveShopStatus = order.order_status;
        }
      }

      if (['delivering', 'delivered', 'shipped', 'completed', 'cancelled'].includes(order.order_status)) {
        effectiveShopStatus = order.order_status;
      }

      return {
        ...order,
        subtotal: myShopSubtotal,
        total_amount: myShopSubtotal,
        order_status: effectiveShopStatus,
        pickup_proof_image: shopPickupProof,
        items: itemsToDisplay.map(item => ({
          ...item,
          product_name: item.product_name || item.db_product_name || 'สินค้า',
          shop_name: item.item_shop_name || order.shop_name || 'ร้านค้า'
        })),
        all_items: allOrderItems.map(item => ({
          ...item,
          product_name: item.product_name || item.db_product_name || 'สินค้า',
          shop_name: item.item_shop_name || order.shop_name || 'ร้านค้า'
        })),
        all_items_count: allOrderItems.length,
        my_items_count: myShopItems.length
      };
    });`;

if (content.includes(oldShopOrdersFormat)) {
  content = content.replace(oldShopOrdersFormat, newShopOrdersFormat);
}

// 5. Patch PUT /api/orders/:orderId/status to support per-shop status updates
const oldStatusEndpoint = `// อัปเดตสถานะคำสั่งซื้อ (Order Status Update)
app.put('/api/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { order_status } = req.body;

  const validStatuses = ['pending', 'paid', 'preparing', 'ready', 'finding_rider', 'delivering', 'shipped', 'completed', 'cancelled'];
  if (!validStatuses.includes(order_status)) {
    return res.status(400).json({ success: false, message: 'สถานะคำสั่งซื้อไม่ถูกต้อง' });
  }

  try {
    await db.execute(
      'UPDATE orders SET order_status = ? WHERE order_id = ?',
      [order_status, orderId]
    );`;

const newStatusEndpoint = `// อัปเดตสถานะคำสั่งซื้อ (Order Status Update)
app.put('/api/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { order_status, shop_id } = req.body;

  const validStatuses = ['pending', 'paid', 'preparing', 'ready', 'finding_rider', 'delivering', 'shipped', 'completed', 'cancelled'];
  if (!validStatuses.includes(order_status)) {
    return res.status(400).json({ success: false, message: 'สถานะคำสั่งซื้อไม่ถูกต้อง' });
  }

  try {
    const [existingOrders] = await db.execute('SELECT shop_statuses, order_status, shop_id, user_id FROM orders WHERE order_id = ?', [orderId]);
    let currentShopStatuses = {};
    if (existingOrders.length > 0 && existingOrders[0].shop_statuses) {
      try { currentShopStatuses = typeof existingOrders[0].shop_statuses === 'string' ? JSON.parse(existingOrders[0].shop_statuses) : existingOrders[0].shop_statuses; } catch(e) {}
    }

    if (shop_id) {
      currentShopStatuses[String(shop_id)] = order_status;
    }

    // Find all distinct shop_ids in this order
    const [itemShops] = await db.execute('SELECT DISTINCT shop_id FROM order_items WHERE order_id = ? AND shop_id IS NOT NULL', [orderId]);
    const distinctShopIds = itemShops.map(s => String(s.shop_id));
    if (distinctShopIds.length === 0 && existingOrders.length > 0 && existingOrders[0].shop_id) {
      distinctShopIds.push(String(existingOrders[0].shop_id));
    }

    // Check if all shops are ready
    const allShopsReady = distinctShopIds.length > 0 && distinctShopIds.every(sid => currentShopStatuses[sid] === 'ready');
    const newGlobalStatus = allShopsReady ? 'ready' : (order_status === 'preparing' ? 'preparing' : (distinctShopIds.length <= 1 ? order_status : existingOrders[0]?.order_status || 'preparing'));

    await db.execute(
      'UPDATE orders SET order_status = ?, shop_statuses = ? WHERE order_id = ?',
      [newGlobalStatus, JSON.stringify(currentShopStatuses), orderId]
    );`;

if (content.includes(oldStatusEndpoint)) {
  content = content.replace(oldStatusEndpoint, newStatusEndpoint);
}

fs.writeFileSync(serverPath, content, 'utf8');
console.log('✅ Successfully patched multi-shop status and isolated seller calculations in server.js');
