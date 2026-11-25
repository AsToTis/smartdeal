const mysql = require('mysql2/promise');

async function updateShops() {
  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'smart_deal_db'
  });

  const [shops] = await db.execute('SELECT shop_id, name FROM shops');
  
  const minLat = 16.1700;
  const maxLat = 16.2000;
  const minLng = 103.2800;
  const maxLng = 103.3200;

  for (let shop of shops) {
    const lat = minLat + Math.random() * (maxLat - minLat);
    const lng = minLng + Math.random() * (maxLng - minLng);
    
    await db.execute('UPDATE shops SET latitude = ?, longitude = ?, address = ? WHERE shop_id = ?', 
      [lat, lng, 'อ.เมือง จ.มหาสารคาม', shop.shop_id]);
    console.log(`Updated shop ${shop.name} to Mahasarakham (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
  }
  
  // Update recent orders so they don't have static Bangkok delivery coordinates
  // (We'll clear delivery_lat/lng so the fallback in tracking.tsx takes over and uses Mahasarakham)
  await db.execute('UPDATE orders SET delivery_lat = NULL, delivery_lng = NULL');
  console.log('Cleared static delivery_lat/lng from orders to use fallbacks.');

  await db.end();
}

updateShops().catch(console.error);
