const fs = require('fs');
const file = 'src/server.js';
let content = fs.readFileSync(file, 'utf8');

// We need to fix the isOpen definition order and add opening_time to the queries.
// I will write a simple regex replacement to fix the home-data endpoint.
const homeDataRegex = /app\.get\('\/api\/home-data', async \(req, res\) => \{[\s\S]*?res\.json\(\{[\s\S]*?\}\);\s*\} catch \(err\) \{/g;

const newHomeData = `app.get('/api/home-data', async (req, res) => {
  try {
    const [categories] = await db.execute('SELECT * FROM categories');
    
    // Add opening_time and closing_time to query
    const [products] = await db.execute(\`
      SELECT 
        p.*,
        s.name AS shop_name,
        s.image_url AS shop_image,
        s.opening_time,
        s.closing_time
      FROM products p
      LEFT JOIN shops s ON p.shop_id = s.shop_id
      WHERE p.stock_quantity > 0 AND p.is_auction = 0 AND (p.deal_end_time IS NULL OR p.deal_end_time > NOW()) 
      ORDER BY p.deal_end_time IS NULL ASC, p.deal_end_time ASC
    \`);
    
    const [shops] = await db.execute('SELECT * FROM shops');

    // Define isOpen first!
    const now = new Date();
    const thTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const currentHourMin = thTime.toISOString().substring(11, 16); // "HH:MM"

    const isOpen = (p) => {
      if (!p.opening_time || !p.closing_time) return true;
      const o = p.opening_time.substring(0, 5);
      const c = p.closing_time.substring(0, 5);
      if (o < c) {
        return currentHourMin >= o && currentHourMin <= c;
      } else {
        return currentHourMin >= o || currentHourMin <= c;
      }
    };

    // Filter deals and shops
    const deals = products.filter(isOpen).map(p => {
      const rawExpires = p.deal_end_time || p.expires_at || p.end_time || p.pickup_end_time;
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

    const formattedShops = shops.filter(isOpen).map(s => ({
      ...s,
      name: s.name || s.shop_name || ''
    }));

    res.json({
      success: true,
      categories,
      deals,
      shops: formattedShops
    });

  } catch (err) {`;

content = content.replace(homeDataRegex, newHomeData);

// Now patch /api/products
const productsRegex = /app\.get\('\/api\/products', async \(req, res\) => \{[\s\S]*?res\.json\(\{ success: true, products: formattedProducts \}\);\s*\} catch \(err\) \{/g;
const newProducts = `app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await db.execute(\`
      SELECT 
        p.*,
        s.name AS shop_name,
        s.image_url AS shop_image,
        s.opening_time,
        s.closing_time
      FROM products p
      LEFT JOIN shops s ON p.shop_id = s.shop_id
      WHERE p.stock_quantity > 0 AND (p.deal_end_time IS NULL OR p.deal_end_time > NOW())
    \`);

    const now = new Date();
    const thTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const currentHourMin = thTime.toISOString().substring(11, 16);
    const isOpen = (p) => {
      if (!p.opening_time || !p.closing_time) return true;
      const o = p.opening_time.substring(0, 5);
      const c = p.closing_time.substring(0, 5);
      if (o < c) return currentHourMin >= o && currentHourMin <= c;
      return currentHourMin >= o || currentHourMin <= c;
    };

    const formattedProducts = rows.filter(isOpen).map(p => {
      const rawExpires = p.deal_end_time || p.expires_at || p.end_time || p.pickup_end_time;
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
  } catch (err) {`;
content = content.replace(productsRegex, newProducts);

fs.writeFileSync(file, content);
console.log('Fixed home-data and products endpoints');
