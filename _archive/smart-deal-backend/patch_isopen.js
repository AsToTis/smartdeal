const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'server.js');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Replace home-data endpoint
const homeDataStart = code.indexOf("app.get('/api/home-data'");
const homeDataEnd = code.indexOf("app.get('/api/products'");

if (homeDataStart !== -1 && homeDataEnd !== -1) {
  const homeDataNew = `app.get('/api/home-data', async (req, res) => {
  try {
    const [categories] = await db.execute('SELECT * FROM categories');
    
    // Get products with shop open status
    const [products] = await db.execute(\`
      SELECT 
        p.*,
        s.name AS shop_name,
        s.image_url AS shop_image,
        IFNULL(s.is_open, 1) AS is_open
      FROM products p
      LEFT JOIN shops s ON p.shop_id = s.shop_id
      WHERE p.stock_quantity > 0 AND p.is_auction = 0 AND (s.is_open IS NULL OR s.is_open = 1)
      ORDER BY p.deal_end_time IS NULL ASC, p.deal_end_time ASC
    \`);
    
    const [shops] = await db.execute('SELECT *, IFNULL(is_open, 1) AS is_open FROM shops');

    // Filter deals and shops based on is_open (1 = open, 0 = closed)
    const deals = products
      .filter(p => p.is_open === 1 || p.is_open === true || p.is_open == '1' || p.is_open === null || p.is_open === undefined)
      .map(p => {
        const rawExpires = p.deal_end_time || p.expiry_time || p.expires_at || p.end_time || p.pickup_end_time;
        const formattedExpiresAt = rawExpires ? new Date(rawExpires).toISOString() : null;

        const origPrice = parseFloat(p.original_price ?? p.price ?? 0);
        const discPrice = parseFloat(p.discount_price ?? p.price ?? 0);
        const stockQty = parseInt(p.stock_quantity !== undefined && p.stock_quantity !== null ? p.stock_quantity : 5, 10);

        return {
          ...p,
          price: discPrice,
          original_price: origPrice,
          discount_price: discPrice,
          stock_quantity: stockQty,
          deal_end_time: formattedExpiresAt,
          expires_at: formattedExpiresAt,
          shop_name: p.shop_name || 'ร้านค้าพรีเมียม',
          shop_image: p.shop_image || ''
        };
      });

    const formattedShops = shops
      .filter(s => s.is_open === 1 || s.is_open === true || s.is_open == '1' || s.is_open === null || s.is_open === undefined)
      .map(s => ({
        ...s,
        name: s.name || s.shop_name || ''
      }));

    res.json({
      success: true,
      categories,
      deals,
      shops: formattedShops
    });

  } catch (err) {
    console.error('❌ Error (/api/home-data):', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

`;
  code = code.substring(0, homeDataStart) + homeDataNew + code.substring(homeDataEnd);
}

// 2. Replace /api/products
const productsStart = code.indexOf("app.get('/api/products'");
const productsEnd = code.indexOf("app.get('/api/products/:id'");

if (productsStart !== -1 && productsEnd !== -1) {
  const productsNew = `app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await db.execute(\`
      SELECT 
        p.*,
        s.name AS shop_name,
        s.image_url AS shop_image,
        IFNULL(s.is_open, 1) AS is_open
      FROM products p
      LEFT JOIN shops s ON p.shop_id = s.shop_id
      WHERE p.stock_quantity > 0 AND (s.is_open IS NULL OR s.is_open = 1)
      ORDER BY p.deal_end_time IS NULL ASC, p.deal_end_time ASC
    \`);

    const formattedProducts = rows.map(p => {
      const rawExpires = p.deal_end_time || p.expiry_time || p.expires_at || p.end_time || p.pickup_end_time;
      const formattedExpiresAt = rawExpires ? new Date(rawExpires).toISOString() : null;

      const origPrice = parseFloat(p.original_price ?? p.price ?? 0);
      const discPrice = parseFloat(p.discount_price ?? p.price ?? 0);
      const stockQty = parseInt(p.stock_quantity !== undefined && p.stock_quantity !== null ? p.stock_quantity : 5, 10);

      return {
        ...p,
        price: discPrice,
        original_price: origPrice,
        discount_price: discPrice,
        stock_quantity: stockQty,
        deal_end_time: formattedExpiresAt,
        expires_at: formattedExpiresAt,
        shop_name: p.shop_name || 'ร้านค้าพรีเมียม',
        shop_image: p.shop_image || ''
      };
    });

    res.json({ success: true, products: formattedProducts });
  } catch (err) {
    console.error('❌ SQL Error (/api/products):', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

`;
  code = code.substring(0, productsStart) + productsNew + code.substring(productsEnd);
}

// 3. Replace seller settings endpoints & add toggle endpoint
const settingsStart = code.indexOf("app.get('/api/seller/settings/:owner_id'");
const settingsEnd = code.indexOf("// COMPLAINTS (Help Center)");

if (settingsStart !== -1 && settingsEnd !== -1) {
  const settingsNew = `app.get('/api/seller/settings/:owner_id', async (req, res) => {
  try {
    const owner_id = req.params.owner_id;
    const [rows] = await db.execute('SELECT s.shop_id, s.name, s.address, s.opening_hours, s.bank_name, s.bank_account, s.image_url, s.latitude, s.longitude, IFNULL(s.is_open, 1) AS is_open, u.full_name AS owner_name FROM shops s JOIN users u ON s.owner_id = u.user_id WHERE s.owner_id = ?', [owner_id]);
    if (rows.length === 0) return res.json({ success: false, message: 'Shop not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/seller/settings/:shop_id/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    const imageUrl = '/uploads/' + req.file.filename;
    await db.execute('UPDATE shops SET image_url = ? WHERE shop_id = ?', [imageUrl, req.params.shop_id]);
    res.json({ success: true, image_url: imageUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/seller/settings/:shop_id', async (req, res) => {
  try {
    const shop_id = req.params.shop_id;
    const { name, address, opening_hours, bank_name, bank_account, latitude, longitude, is_open } = req.body;
    try {
      await db.execute('ALTER TABLE shops ADD COLUMN is_open TINYINT(1) NOT NULL DEFAULT 1');
    } catch(e) {}
    
    await db.execute(
      'UPDATE shops SET name = ?, address = ?, opening_hours = ?, bank_name = ?, bank_account = ?, latitude = ?, longitude = ?, is_open = IFNULL(?, is_open) WHERE shop_id = ?', 
      [name, address, opening_hours, bank_name, bank_account, latitude || null, longitude || null, is_open !== undefined ? is_open : null, shop_id]
    );
    res.json({ success: true, message: 'บันทึกข้อมูลสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/seller/toggle-status/:shop_id', async (req, res) => {
  try {
    const shop_id = req.params.shop_id;
    const { is_open } = req.body;
    try {
      await db.execute('ALTER TABLE shops ADD COLUMN is_open TINYINT(1) NOT NULL DEFAULT 1');
    } catch(e) {}
    
    const newStatus = is_open ? 1 : 0;
    await db.execute('UPDATE shops SET is_open = ? WHERE shop_id = ?', [newStatus, shop_id]);
    res.json({ success: true, is_open: newStatus, message: newStatus ? 'เปิดร้านสำเร็จ' : 'ปิดร้านชั่วคราวสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
`;
  code = code.substring(0, settingsStart) + settingsNew + code.substring(settingsEnd);
}

// 4. Update seller dashboard endpoint
code = code.replace(
  "const [shopData] = await db.execute('SELECT shop_id, name, status FROM shops WHERE owner_id = ?', [owner_id]);",
  "const [shopData] = await db.execute('SELECT shop_id, name, status, IFNULL(is_open, 1) AS is_open FROM shops WHERE owner_id = ?', [owner_id]);"
);

fs.writeFileSync(filePath, code, 'utf8');
console.log('✅ server.js patched successfully!');
