const fs = require('fs');
const file = 'src/server.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Update PUT /api/seller/settings/:shop_id to save opening_time, closing_time
const oldSettingsPut = `    const { name, address, opening_hours, bank_name, bank_account, latitude, longitude } = req.body;
    await db.execute('UPDATE shops SET name = ?, address = ?, opening_hours = ?, bank_name = ?, bank_account = ?, latitude = ?, longitude = ? WHERE shop_id = ?', [name, address, opening_hours, bank_name, bank_account, latitude || null, longitude || null, shop_id]);`;

const newSettingsPut = `    const { name, address, opening_hours, bank_name, bank_account, latitude, longitude, opening_time, closing_time } = req.body;
    // Add columns if they don't exist yet (auto-migration)
    try {
      await db.execute('ALTER TABLE shops ADD COLUMN opening_time TIME DEFAULT "00:00:00", ADD COLUMN closing_time TIME DEFAULT "23:59:59"');
    } catch(e) {} // Ignore if already exists

    await db.execute('UPDATE shops SET name = ?, address = ?, opening_hours = ?, bank_name = ?, bank_account = ?, latitude = ?, longitude = ?, opening_time = IFNULL(?, opening_time), closing_time = IFNULL(?, closing_time) WHERE shop_id = ?', 
      [name, address, opening_hours, bank_name, bank_account, latitude || null, longitude || null, opening_time || null, closing_time || null, shop_id]);`;

if (content.includes(oldSettingsPut)) {
  content = content.replace(oldSettingsPut, newSettingsPut);
}

// 2. Filter products in /api/home-data based on shop hours
const oldHomeProductsQuery = `      SELECT 
        p.*,
        s.name AS shop_name,
        s.image_url AS shop_image
      FROM products p
      LEFT JOIN shops s ON p.shop_id = s.shop_id
      WHERE p.stock_quantity > 0 AND p.is_auction = 0 AND (p.deal_end_time IS NULL OR p.deal_end_time > NOW()) ORDER BY p.deal_end_time IS NULL ASC, p.deal_end_time ASC`;

const newHomeProductsQuery = `      SELECT 
        p.*,
        s.name AS shop_name,
        s.image_url AS shop_image,
        s.opening_time,
        s.closing_time
      FROM products p
      LEFT JOIN shops s ON p.shop_id = s.shop_id
      WHERE p.stock_quantity > 0 AND p.is_auction = 0 AND (p.deal_end_time IS NULL OR p.deal_end_time > NOW()) ORDER BY p.deal_end_time IS NULL ASC, p.deal_end_time ASC`;

content = content.replace(oldHomeProductsQuery, newHomeProductsQuery);

const oldHomeMap = `    const deals = products.map(p => {`;
const newHomeMap = `
    const now = new Date();
    // Thai time = UTC+7
    const thTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const currentHourMin = thTime.toISOString().substring(11, 16); // "HH:MM"

    const isOpen = (p) => {
      if (!p.opening_time || !p.closing_time) return true;
      const o = p.opening_time.substring(0, 5);
      const c = p.closing_time.substring(0, 5);
      if (o < c) {
        return currentHourMin >= o && currentHourMin <= c;
      } else {
        // Crosses midnight e.g. 18:00 - 02:00
        return currentHourMin >= o || currentHourMin <= c;
      }
    };

    const deals = products.filter(isOpen).map(p => {`;

content = content.replace(oldHomeMap, newHomeMap);

// 3. Filter shops in /api/home-data based on shop hours
const oldHomeShopsQuery = `const [shops] = await db.execute('SELECT * FROM shops');`;
const newHomeShopsQuery = `const [shops] = await db.execute('SELECT * FROM shops');\n    const filteredShops = shops.filter(isOpen);`;
content = content.replace(oldHomeShopsQuery, newHomeShopsQuery);
content = content.replace(`shops: formattedShops`, `shops: formattedShops.filter(isOpen)`);

// Wait, formattedShops is mapped from shops, but isOpen expects p.opening_time which shops also has.
const oldFormattedShopsMap = `const formattedShops = shops.map(s => ({`;
const newFormattedShopsMap = `const formattedShops = shops.filter(isOpen).map(s => ({`;
content = content.replace(oldFormattedShopsMap, newFormattedShopsMap);

fs.writeFileSync(file, content);
console.log('Backend shop hours logic patched');
