const db = require('../../src/db');

async function seedData() {
  console.log('🚀 Starting Smart Deal Database Enrichment...');

  // 1. Create / Ensure Shop Owner Users
  console.log('--- Step 1: Ensuring Shop Owners ---');
  const shopOwners = [
    { email: 'owner.zen@smartdeal.com', phone: '0811112222', full_name: 'ธนากร มัตสึดะ', role: 'seller', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200' },
    { email: 'owner.paul@smartdeal.com', phone: '0822223333', full_name: 'ปิแอร์ เดอลาฟรองซ์', role: 'seller', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200' },
    { email: 'owner.sushiro@smartdeal.com', phone: '0833334444', full_name: 'กิตติศักดิ์ ซูชิบาร์', role: 'seller', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200' },
    { email: 'owner.coffee@smartdeal.com', phone: '0844445555', full_name: 'ณัฐวุฒิ คาเฟอีน', role: 'seller', avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200' },
    { email: 'owner.clean@smartdeal.com', phone: '0855556666', full_name: 'พิมพิศา สุขภาพดี', role: 'seller', avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200' },
    { email: 'owner.thaifood@smartdeal.com', phone: '0866667777', full_name: 'ป้าสมศรี ครัวไทยเดิม', role: 'seller', avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200' },
    { email: 'owner.bake@smartdeal.com', phone: '0877778888', full_name: 'อัญชลี ขนมอบอุ่น', role: 'seller', avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200' },
    { email: 'owner.fruit@smartdeal.com', phone: '0888889999', full_name: 'เสี่ยสมบัติ ผลไม้สดทองหล่อ', role: 'seller', avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200' },
    { email: 'owner.steak@smartdeal.com', phone: '0899990000', full_name: 'เชฟมาร์ค สเต็กเฮ้าส์', role: 'seller', avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200' },
  ];

  const ownerMap = {}; // email -> user_id
  for (const owner of shopOwners) {
    const [existing] = await db.query('SELECT user_id FROM users WHERE email = ?', [owner.email]);
    if (existing.length > 0) {
      ownerMap[owner.email] = existing[0].user_id;
    } else {
      const [res] = await db.query(
        'INSERT INTO users (email, phone, password_hash, full_name, role, status, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [owner.email, owner.phone, '$2a$10$abcdefghijklmnopqrstuvwxyz123456', owner.full_name, owner.role, 'active', owner.avatar_url]
      );
      ownerMap[owner.email] = res.insertId;
    }
  }

  // 2. Clear out older mock shops / Update existing shops with rich verifiable details
  console.log('--- Step 2: Seeding Realistic Shops with Complete Verification Details ---');
  
  const shopsData = [
    {
      shop_id: 1,
      name: 'Zen Japanese Restaurant (สุขุมวิท 21)',
      owner_id: ownerMap['owner.zen@smartdeal.com'],
      category_id: 2,
      description: 'ร้านอาหารญี่ปุ่นเกรดพรีเมียม วัตถุดิบนำเข้าสดใหม่วันต่อวัน มีเมนูซูชิ ซาชิมิ เบนโตะ ลดราคาพิเศษช่วงปิดรอบครัวเพื่อลด Food Waste',
      address: '123/45 ถนนสุขุมวิท 21 (อโศก) แขวงคลองเตยเหนือ เขตวัฒนา กรุงเทพฯ 10110',
      latitude: 13.74320000,
      longitude: 100.56080000,
      image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
      rating: 4.8,
      distance: '0.8 km',
      tag1: 'อาหารญี่ปุ่น',
      tag2: 'ซูชิสดลด 50%',
      opening_hours: 'ทุกวัน 10:30 - 21:00',
      bank_name: 'KBANK (กสิกรไทย)',
      bank_account: '023-8-49210-4',
      promptpay_number: '0811112222',
      id_card_image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
      bookbank_image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
      status: 'approved'
    },
    {
      shop_id: 2,
      name: "Paul's French Bakery & Patisserie",
      owner_id: ownerMap['owner.paul@smartdeal.com'],
      category_id: 1,
      description: 'เบเกอรี่สไตล์ฝรั่งเศสแท้ๆ อบสดใหม่ทุกเช้า ไม่ใช้วัตถุกันเสีย ครัวซองต์เนยสดฝรั่งเศส ทาร์ตผลไม้ และขนมปังซาวโดว์ พร้อมปล่อย Flash Sale ทุกเย็น',
      address: '88/1 ถนนสุขุมวิท 55 (ทองหล่อ ซอย 10) แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110',
      latitude: 13.73450000,
      longitude: 100.58240000,
      image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
      rating: 4.9,
      distance: '1.2 km',
      tag1: 'เบเกอรี่ฝรั่งเศส',
      tag2: 'อบสดใหม่',
      opening_hours: 'ทุกวัน 07:00 - 19:30',
      bank_name: 'SCB (ไทยพาณิชย์)',
      bank_account: '408-2-88192-1',
      promptpay_number: '0822223333',
      id_card_image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
      bookbank_image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
      status: 'approved'
    },
    {
      shop_id: 3,
      name: 'The Green Garden Bistro & Cafe',
      owner_id: ownerMap['owner.clean@smartdeal.com'],
      category_id: 2,
      description: 'ร้านอาหารสุขภาพและคาเฟ่ออร์แกนิก สลัดผักไฮโดรโปนิกส์สดจากฟาร์ม และข้าวกล่องคลีนแคลอรี่ต่ำ ปรุงสดสะอาด ปล่อยดีลลดกระหน่ำก่อนหมดรอบวัน',
      address: '55 อาคารสมาร์ททาวเวอร์ ชั้น G ถนนพระราม 4 แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
      latitude: 13.72250000,
      longitude: 100.55900000,
      image_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
      rating: 4.7,
      distance: '1.5 km',
      tag1: 'อาหารคลีน',
      tag2: 'ออร์แกนิก',
      opening_hours: 'จันทร์ - เสาร์ 08:00 - 20:00',
      bank_name: 'BBL (กรุงเทพ)',
      bank_account: '101-9-33491-0',
      promptpay_number: '0855556666',
      id_card_image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
      bookbank_image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
      status: 'approved'
    },
    {
      shop_id: 4,
      name: 'Sushiro Central World ชั้น 6',
      owner_id: ownerMap['owner.sushiro@smartdeal.com'],
      category_id: 2,
      description: 'ซูชิสายพานอันดับ 1 เมนูซูชิแซลมอน ทูน่า และปลาไหลย่าง เกรดภัตตาคาร เซ็ตกล่อง Take Away ปล่อยประมูลและดีลส่วนเกินทุกชั่วโมงเร่งด่วน',
      address: '999/9 ศูนย์การค้าเซ็นทรัลเวิลด์ ชั้น 6 ถนนพระราม 1 แขวงปทุมวัน เขตปทุมวัน กรุงเทพฯ 10330',
      latitude: 13.74660000,
      longitude: 100.53930000,
      image_url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800',
      rating: 4.9,
      distance: '2.1 km',
      tag1: 'ซูชิพรีเมียม',
      tag2: 'ดีลเด็ดด่วน',
      opening_hours: 'ทุกวัน 10:00 - 21:30',
      bank_name: 'KBANK (กสิกรไทย)',
      bank_account: '772-1-98745-3',
      promptpay_number: '0833334444',
      id_card_image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
      bookbank_image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
      status: 'approved'
    },
    {
      shop_id: 5,
      name: 'Organic Specialty Coffee & Roasters',
      owner_id: ownerMap['owner.coffee@smartdeal.com'],
      category_id: 4,
      description: 'โรงคั่วกาแฟและเบเกอรี่โฮมเมด เมล็ดกาแฟ Single Origin จากดอยช้าง ชาเขียวมัทฉะเกรดพิธีการ และแซนด์วิชอบสด',
      address: '42 ซอยสุขุมวิท 39 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110',
      latitude: 13.73880000,
      longitude: 100.57120000,
      image_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800',
      rating: 4.8,
      distance: '1.1 km',
      tag1: 'Specialty Coffee',
      tag2: 'เครื่องดื่ม & เบเกอรี่',
      opening_hours: 'ทุกวัน 07:30 - 18:00',
      bank_name: 'TTB (ทีเอ็มบีธนชาต)',
      bank_account: '228-2-44119-0',
      promptpay_number: '0844445555',
      id_card_image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
      bookbank_image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
      status: 'approved'
    },
    {
      shop_id: 6,
      name: 'ครัวไทยรสเด็ดแม่สมศรี (ทองหล่อ)',
      owner_id: ownerMap['owner.thaifood@smartdeal.com'],
      category_id: 2,
      description: 'อาหารไทยรสชาติเข้มข้นถึงเครื่อง ทั้งต้มยำกุ้งน้ำข้น กะเพราหมูกรอบ แกงเขียวหวานไก่ ปรุงสดใหม่กล่องต่อกล่อง มีชุดกับข้าวราคาประหยัดก่อนปิดร้าน',
      address: '14/3 ซอยทองหล่อ 13 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110',
      latitude: 13.73300000,
      longitude: 100.58400000,
      image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
      rating: 4.6,
      distance: '1.8 km',
      tag1: 'อาหารไทยแท้',
      tag2: 'ปรุงสดใหม่',
      opening_hours: 'ทุกวัน 10:00 - 21:00',
      bank_name: 'KTB (กรุงไทย)',
      bank_account: '091-0-77651-8',
      promptpay_number: '0866667777',
      id_card_image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
      bookbank_image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
      status: 'approved'
    },
    {
      shop_id: 7,
      name: 'Sweet Tooth Bakehouse & Dessert',
      owner_id: ownerMap['owner.bake@smartdeal.com'],
      category_id: 5,
      description: 'เค้กและขนมหวานพรีเมียม ชีสเค้กหน้าไหม้ ช็อกโกแลตฟัดจ์ และชูครีมไส้ทะลัก ทำสดใหม่ไม่ใส่สารกันบูด จัดเซ็ต Mystery Box ลดราคาสูงสุด 70%',
      address: '77 ซอยสุขุมวิท 49 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110',
      latitude: 13.73100000,
      longitude: 100.57800000,
      image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
      rating: 4.9,
      distance: '1.4 km',
      tag1: 'เค้ก & เบเกอรี่',
      tag2: 'ลด 60-70%',
      opening_hours: 'ทุกวัน 09:00 - 20:00',
      bank_name: 'KBANK (กสิกรไทย)',
      bank_account: '654-2-11983-4',
      promptpay_number: '0877778888',
      id_card_image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
      bookbank_image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
      status: 'approved'
    },
    {
      shop_id: 8,
      name: 'Golden Fruit & Healthy Farm (ผลไม้พรีเมียม)',
      owner_id: ownerMap['owner.fruit@smartdeal.com'],
      category_id: 3,
      description: 'ผลไม้นำเข้าและผลไม้ไทยคัดพิเศษ สตรอว์เบอร์รีเกาหลี องุ่นไชน์มัสคัส และผลไม้พร้อมทาน ตัดแต่งสด สะอาด จัดจำหน่ายในราคาประหยัดก่อนหมดวัน',
      address: '202 ซอยเอกมัย 12 ถนนสุขุมวิท 63 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110',
      latitude: 13.72900000,
      longitude: 100.58900000,
      image_url: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800',
      rating: 4.8,
      distance: '2.4 km',
      tag1: 'ผลไม้สดนำเข้า',
      tag2: 'พร้อมทาน',
      opening_hours: 'ทุกวัน 08:00 - 20:00',
      bank_name: 'SCB (ไทยพาณิชย์)',
      bank_account: '312-4-99812-7',
      promptpay_number: '0888889999',
      id_card_image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
      bookbank_image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
      status: 'approved'
    },
    {
      shop_id: 9,
      name: 'Prime Cut Steakhouse & Butcher (รอตรวจสอบ)',
      owner_id: ownerMap['owner.steak@smartdeal.com'],
      category_id: 2,
      description: 'สเต็กเนื้อดรายเอจนำเข้าจากออสเตรเลียและญี่ปุ่น เบอร์เกอร์เนื้อวากิวระดับพรีเมียม ส่งเอกสารขอเปิดร้านบน Smart Deal',
      address: '310 ถนนพระราม 9 แขวงบางกะปิ เขตห้วยขวาง กรุงเทพฯ 10310',
      latitude: 13.75000000,
      longitude: 100.56500000,
      image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
      rating: 4.7,
      distance: '3.2 km',
      tag1: 'สเต็กเนื้อพรีเมียม',
      tag2: 'Wagyu',
      opening_hours: 'ทุกวัน 11:00 - 22:00',
      bank_name: 'KBANK (กสิกรไทย)',
      bank_account: '908-2-33412-1',
      promptpay_number: '0899990000',
      id_card_image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600',
      bookbank_image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
      status: 'pending' // For Admin verification test!
    }
  ];

  for (const shop of shopsData) {
    const [exists] = await db.query('SELECT shop_id FROM shops WHERE shop_id = ?', [shop.shop_id]);
    if (exists.length > 0) {
      await db.query(
        `UPDATE shops SET 
          name = ?, owner_id = ?, category_id = ?, description = ?, address = ?, 
          latitude = ?, longitude = ?, image_url = ?, rating = ?, distance = ?, 
          tag1 = ?, tag2 = ?, opening_hours = ?, bank_name = ?, bank_account = ?, 
          promptpay_number = ?, id_card_image = ?, bookbank_image = ?, status = ?
        WHERE shop_id = ?`,
        [
          shop.name, shop.owner_id, shop.category_id, shop.description, shop.address,
          shop.latitude, shop.longitude, shop.image_url, shop.rating, shop.distance,
          shop.tag1, shop.tag2, shop.opening_hours, shop.bank_name, shop.bank_account,
          shop.promptpay_number, shop.id_card_image, shop.bookbank_image, shop.status,
          shop.shop_id
        ]
      );
    } else {
      await db.query(
        `INSERT INTO shops (
          shop_id, name, owner_id, category_id, description, address, 
          latitude, longitude, image_url, rating, distance, 
          tag1, tag2, opening_hours, bank_name, bank_account, 
          promptpay_number, id_card_image, bookbank_image, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          shop.shop_id, shop.name, shop.owner_id, shop.category_id, shop.description, shop.address,
          shop.latitude, shop.longitude, shop.image_url, shop.rating, shop.distance,
          shop.tag1, shop.tag2, shop.opening_hours, shop.bank_name, shop.bank_account,
          shop.promptpay_number, shop.id_card_image, shop.bookbank_image, shop.status
        ]
      );
    }
  }

  // 3. Clear and Repopulate Products (25-30 items, 3-4 items per shop, expiring fast surplus food)
  console.log('--- Step 3: Seeding 25+ Surplus Food Products with Exact Images and Real Expiries ---');
  await db.query('DELETE FROM products'); // Reset cleanly

  const productsList = [
    // Shop 1: Zen Japanese Restaurant (3-4 items)
    {
      shop_id: 1, category_id: 2,
      name: 'เซ็ตซูชิแซลมอน & ทูน่ารวมพรีเมียม (10 คำ)',
      original_price: 320.00, discount_price: 129.00, discount_percent: 60,
      expiry_text: 'หมดอายุใน 1 ชม. 30 นาที',
      freshness: 'สดใหม่ ทำรอบบ่าย', shipping_type: 'ควบคุมอุณหภูมิ',
      description: 'ซูชิแซลมอนนอร์เวย์สด ทูน่า และข้าวปั้นญี่ปุ่นแท้ คัดเกรดโอมากาเสะ ปรุงสดรอบ 16:00 น. ลดกระหน่ำก่อนปิดรอบเย็น',
      image_url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600',
      stock_quantity: 4
    },
    {
      shop_id: 1, category_id: 2,
      name: 'ข้าวหน้าไก่ย่างเทอริยากิ & ไข่ออนเซ็น',
      original_price: 150.00, discount_price: 59.00, discount_percent: 61,
      expiry_text: 'หมดอายุใน 45 นาที',
      freshness: 'ทำสดใหม่ อุ่นร้อนได้', shipping_type: 'ส่งด่วนทันที',
      description: 'สะโพกไก่ย่างเตาถ่านซอสเทอริยากิสูตรลับ เสิร์ฟพร้อมไข่ออนเซ็นและผักดองญี่ปุ่น อร่อยคุ้มค่าเกินราคา',
      image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
      stock_quantity: 3
    },
    {
      shop_id: 1, category_id: 2,
      name: 'ซุปมิโซะปลาแซลมอนหม้อไฟ',
      original_price: 95.00, discount_price: 35.00, discount_percent: 63,
      expiry_text: 'หมดอายุใน 2 ชม.',
      freshness: 'ร้อนกรุ่น ต้มใหม่', shipping_type: 'จัดส่งกล่องเก็บความร้อน',
      description: 'ซุปมิโซะเข้มข้นใส่เนื้อปลาแซลมอน หัวไชเท้า เต้าหู้นิ่ม และสาหร่ายวากาเมะ ซดคล่องคอ',
      image_url: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600',
      stock_quantity: 5
    },
    {
      shop_id: 1, category_id: 2,
      name: 'สลัดปูอัดไข่กุ้งซอสสไปซี่ญี่ปุ่น',
      original_price: 120.00, discount_price: 45.00, discount_percent: 62,
      expiry_text: 'หมดอายุใน 1 ชม.',
      freshness: 'ผักกรอบ สดใหม่', shipping_type: 'ควบคุมอุณหภูมิ',
      description: 'ผักสลัดไฮโดรโปนิกส์ออร์แกนิก ปูอัดเกรดเอ ไข่กุ้งกรุบกรอบ พร้อมน้ำสลัดงาคั่วสไปซี่สูตรพิเศษ',
      image_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600',
      stock_quantity: 2
    },

    // Shop 2: Paul's French Bakery (4 items)
    {
      shop_id: 2, category_id: 1,
      name: 'ถุงสุ่มพาสทรี & ครัวซองต์พรีเมียม (Mystery Box 3 ชิ้น)',
      original_price: 240.00, discount_price: 69.00, discount_percent: 71,
      expiry_text: 'หมดอายุใน 2 ชม. 45 นาที',
      freshness: 'อบสดใหม่รอบเช้า', shipping_type: 'ส่งด่วน',
      description: 'ถุงสุ่มรวมขนมอบสไตล์ฝรั่งเศส เช่น ครัวซองต์เนยสด ช็อกโกแลตโรล และเดนิชผลไม้ อร่อยคุ้มค่าสุดเซอร์ไพรส์',
      image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600',
      stock_quantity: 5
    },
    {
      shop_id: 2, category_id: 1,
      name: 'ครัวซองต์อัลมอนด์ไส้คัสตาร์ดฝรั่งเศส (2 ชิ้น)',
      original_price: 180.00, discount_price: 65.00, discount_percent: 64,
      expiry_text: 'หมดอายุใน 3 ชม.',
      freshness: 'กรอบนอกนุ่มใน', shipping_type: 'ส่งด่วน',
      description: 'ครัวซองต์เนยแท้ AOP อัดแน่นด้วยครีมอัลมอนด์หอมหวาน โรยหน้าด้วยอัลมอนด์สไลซ์อบกรอบ',
      image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600',
      stock_quantity: 3
    },
    {
      shop_id: 2, category_id: 1,
      name: 'ขนมปังซาวโดว์ธัญพืชโฮลวีทธรรมชาติ (Sourdough Loaf)',
      original_price: 160.00, discount_price: 55.00, discount_percent: 66,
      expiry_text: 'หมดอายุใน 4 ชม.',
      freshness: 'หมักธรรมชาติ ไร้สารกันบูด', shipping_type: 'ส่งด่วน',
      description: 'ขนมปังซาวโดว์หมักยีสต์ธรรมชาตินาน 24 ชั่วโมง อุดมด้วยธัญพืช 7 ชนิด ดีต่อสุขภาพและระบบย่อยอาหาร',
      image_url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=600',
      stock_quantity: 4
    },
    {
      shop_id: 2, category_id: 5,
      name: 'ทาร์ตเลมอนเมอแรงค์สด (Lemon Meringue Tart)',
      original_price: 145.00, discount_price: 49.00, discount_percent: 66,
      expiry_text: 'หมดอายุใน 1 ชม. 15 นาที',
      freshness: 'เก็บในความเย็น', shipping_type: 'ควบคุมอุณหภูมิ',
      description: 'แป้งทาร์ตกรุบกรอบ เลมอนเคิร์ดรสเปรี้ยวอมหวานสดชื่น ท็อปด้วยอิตาเลียนเมอแรงค์เบิร์นไฟหอมกรุ่น',
      image_url: 'https://images.unsplash.com/photo-1519869325930-281384150729?w=600',
      stock_quantity: 2
    },

    // Shop 3: The Green Garden Bistro (3 items)
    {
      shop_id: 3, category_id: 2,
      name: 'สลัดอกไก่นุ่มอะโวคาโด & ควินัวออร์แกนิก',
      original_price: 195.00, discount_price: 69.00, discount_percent: 65,
      expiry_text: 'หมดอายุใน 1 ชม.',
      freshness: 'ผักตัดสดใหม่ ควบคุมแคลอรี่', shipping_type: 'ควบคุมอุณหภูมิ',
      description: 'อกไก่นุ่มซูวี อะโวคาโดฮาสส์ ควินัวสามสี ผักสลัดเบบี้คอส เสิร์ฟคู่น้ำสลัดงาซีอิ๊วญี่ปุ่น คลีน 100%',
      image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600',
      stock_quantity: 4
    },
    {
      shop_id: 3, category_id: 4,
      name: 'น้ำสกัดเย็น Green Detox Booster (300ml)',
      original_price: 120.00, discount_price: 45.00, discount_percent: 63,
      expiry_text: 'หมดอายุใน 2 ชม. 30 นาที',
      freshness: 'สกัดเย็นแท้ ไม่ใส่น้ำตาล', shipping_type: 'ควบคุมความเย็น',
      description: 'น้ำผักผลไม้สกัดเย็นสูตรดีท็อกซ์ ประกอบด้วยเซเลอรี่ แอปเปิ้ลเขียว แตงกวา และมะนาว สดชื่นผิวพรรณสดใส',
      image_url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600',
      stock_quantity: 6
    },
    {
      shop_id: 3, category_id: 2,
      name: 'ข้าวไรซ์เบอร์รี่แซลมอนย่างซีอิ๊วคลีน',
      original_price: 185.00, discount_price: 75.00, discount_percent: 59,
      expiry_text: 'หมดอายุใน 50 นาที',
      freshness: 'ทำสดใหม่ อุ่นพร้อมทาน', shipping_type: 'ส่งด่วน',
      description: 'สเต็กแซลมอนนอร์เวย์ย่างซีอิ๊วโซเดียมต่ำ ข้าวไรซ์เบอร์รี่ออร์แกนิก และผักเคียงนึ่งเพื่อสุขภาพ',
      image_url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600',
      stock_quantity: 3
    },

    // Shop 4: Sushiro Central World (3 items)
    {
      shop_id: 4, category_id: 2,
      name: 'เซ็ตซูชิรวมหน้าพรีเมียม โอโทโร่ & อูนิ (Flash Deal)',
      original_price: 480.00, discount_price: 169.00, discount_percent: 65,
      expiry_text: 'หมดอายุใน 1 ชม.',
      freshness: 'สดพรีเมียมจากญี่ปุ่น', shipping_type: 'ควบคุมอุณหภูมิ',
      description: 'ซูชิเซ็ตพิเศษที่มีทั้งโอโทโร่เนื้อนุ่มละลาย ฮามาจิสดหวาน และอูนิคุณภาพเยี่ยม สำหรับมื้อพิเศษราคาลดแหลก',
      image_url: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=600',
      stock_quantity: 3
    },
    {
      shop_id: 4, category_id: 2,
      name: 'ข้าวหน้าปลาไหลญี่ปุ่นย่างซีอิ๊วคาบายากิ (Unadon)',
      original_price: 320.00, discount_price: 129.00, discount_percent: 60,
      expiry_text: 'หมดอายุใน 1 ชม. 20 นาที',
      freshness: 'ย่างร้อน ซอสเข้มข้น', shipping_type: 'ส่งด่วน',
      description: 'ปลาไหลญี่ปุ่นตัวโต ย่างไฟอ่อนทาซอสคาบายากิสูตรเข้มข้น เนื้อนุ่มละลายในปากบนข้าวญี่ปุ่นร้อนๆ',
      image_url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600',
      stock_quantity: 2
    },
    {
      shop_id: 4, category_id: 2,
      name: 'ยำแซลมอนแซ่บสมุนไพรสดสไตล์ไทย',
      original_price: 160.00, discount_price: 59.00, discount_percent: 63,
      expiry_text: 'หมดอายุใน 45 นาที',
      freshness: 'ทำสด คลุกใหม่', shipping_type: 'ควบคุมอุณหภูมิ',
      description: 'แซลมอนสดหั่นเต๋า คลุกเคล้าน้ำยำสูตรเด็ดพริกสด มะนาวแท้ หอมแดง ตะไคร้ และสะระแหน่ แซ่บจัดจ้าน',
      image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600',
      stock_quantity: 4
    },

    // Shop 5: Organic Specialty Coffee & Roasters (3 items)
    {
      shop_id: 5, category_id: 4,
      name: 'Dirty Coffee นมเย็นจัด & ช็อตเอสเปรสโซ่คั่วเข้ม (2 แก้ว)',
      original_price: 220.00, discount_price: 79.00, discount_percent: 64,
      expiry_text: 'หมดอายุใน 40 นาที',
      freshness: 'ชงสดทันที', shipping_type: 'แยกน้ำแข็งควบคุมความเย็น',
      description: 'เดอร์ตี้คอฟฟี่ นมสูตรพิเศษแช่เย็นจัด เลเยอร์ด้วยเอสเปรสโซ่เข้มข้น หอมมันกลมกล่อมลงตัว',
      image_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600',
      stock_quantity: 4
    },
    {
      shop_id: 5, category_id: 4,
      name: 'มัทฉะลาเต้เกรดพิธีการชิซูโอกะ (Uji Matcha)',
      original_price: 140.00, discount_price: 55.00, discount_percent: 61,
      expiry_text: 'หมดอายุใน 1 ชม.',
      freshness: 'ตีสดใหม่ทุกแก้ว', shipping_type: 'ส่งด่วน',
      description: 'ผงชาเขียวมัทฉะแท้นำเข้าจากอุจิ เกียวโต ตีด้วยแปรงไม้ไผ่ชะเซ็น ผสมนมสดฮอกไกโด รสชาตินุ่มละมุนลิ้น',
      image_url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600',
      stock_quantity: 5
    },
    {
      shop_id: 5, category_id: 1,
      name: 'ครัวซองต์แฮมชีสเชดด้าอบร้อนการันตีเนยสด',
      original_price: 110.00, discount_price: 45.00, discount_percent: 59,
      expiry_text: 'หมดอายุใน 2 ชม.',
      freshness: 'อบสดใหม่', shipping_type: 'ส่งด่วน',
      description: 'แป้งครัวซองต์เนยฝรั่งเศสสอดไส้แฮมหมูพรีเมียมและชีสเชดด้าเยิ้มๆ กัดแล้วฟินทุกคำ',
      image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600',
      stock_quantity: 3
    },

    // Shop 6: ครัวไทยรสเด็ดแม่สมศรี (3 items)
    {
      shop_id: 6, category_id: 2,
      name: 'ข้าวกะเพราหมูกรอบคั่วพริกแห้งโบราณ + ไข่ดาวกรอบ',
      original_price: 95.00, discount_price: 39.00, discount_percent: 59,
      expiry_text: 'หมดอายุใน 45 นาที',
      freshness: 'ผัดสดใหม่ ร้อนจัด', shipping_type: 'ส่งด่วน',
      description: 'หมูกรอบทำเองหนังกรอบฟู ผัดกะเพราพริกแห้งรสจัดจ้านใบกะเพราบ้านหอมฟุ้ง โปะไข่ดาวเป็ดขอบกรอบไข่แดงเยิ้ม',
      image_url: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600',
      stock_quantity: 6
    },
    {
      shop_id: 6, category_id: 2,
      name: 'ต้มยำกุ้งแม่น้ำน้ำข้นหม้อดินชุดพิเศษ',
      original_price: 180.00, discount_price: 69.00, discount_percent: 62,
      expiry_text: 'หมดอายุใน 1 ชม. 15 นาที',
      freshness: 'กุ้งสดใหม่ สมุนไพรแน่น', shipping_type: 'ส่งด่วนแยกน้ำซุป',
      description: 'ต้มยำกุ้งแม่น้ำตัวใหญ่ มันกุ้งเยิ้ม ปรุงด้วยน้ำพริกเผา มะนาวแป้นสด นมข้นจืด และสมุนไพรไทยแท้',
      image_url: 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=600',
      stock_quantity: 3
    },
    {
      shop_id: 6, category_id: 2,
      name: 'แกงเขียวหวานไก่ยอดมะพร้าวอ่อน + ขนมจีนชุดใหญ่',
      original_price: 130.00, discount_price: 49.00, discount_percent: 62,
      expiry_text: 'หมดอายุใน 2 ชม.',
      freshness: 'กะทิคั้นสดใหม่', shipping_type: 'ส่งด่วน',
      description: 'แกงเขียวหวานพริกแกงตำเอง หัวกะทิสดหอมมัน ไก่นุ่ม ยอดมะพร้าวอ่อนกรอบ ทานคู่ขนมจีนแป้งหมักเส้นเหนียวนุ่ม',
      image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600',
      stock_quantity: 4
    },

    // Shop 7: Sweet Tooth Bakehouse (3 items)
    {
      shop_id: 7, category_id: 5,
      name: 'บาสก์ชีสเค้กหน้าไหม้ครีมชีสสเปน (Basque Burnt Cheesecake)',
      original_price: 160.00, discount_price: 59.00, discount_percent: 63,
      expiry_text: 'หมดอายุใน 2 ชม.',
      freshness: 'ครีมชีสแท้ เนื้อเนียนนุ่ม', shipping_type: 'ควบคุมอุณหภูมิ',
      description: 'ชีสเค้กหน้าไหม้สไตล์สเปนแท้ ผิวด้านนอกคาราเมลไหม้หอมกรุ่น เนื้อในนุ่มฉ่ำละลายในปาก',
      image_url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600',
      stock_quantity: 3
    },
    {
      shop_id: 7, category_id: 5,
      name: 'เค้กช็อกโกแลตฟัดจ์ลาวาเบลเยียมเข้มข้น 70%',
      original_price: 150.00, discount_price: 55.00, discount_percent: 63,
      expiry_text: 'หมดอายุใน 2 ชม. 30 นาที',
      freshness: 'ดาร์กช็อกโกแลตแท้', shipping_type: 'ส่งด่วน',
      description: 'เค้กเนื้อฟองน้ำช็อกโกแลตนุ่ม ชุ่มฉ่ำด้วยฟัดจ์ลาวาดาร์กช็อกโกแลตแท้จากเบลเยียม รสชาติเข้มข้นไม่หวานเลี่ยน',
      image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600',
      stock_quantity: 4
    },
    {
      shop_id: 7, category_id: 5,
      name: 'ชูครีมวานิลลามาดากัสการ์ (กล่อง 4 ชิ้นโต)',
      original_price: 140.00, discount_price: 49.00, discount_percent: 65,
      expiry_text: 'หมดอายุใน 1 ชม. 45 นาที',
      freshness: 'บีบไส้สดใหม่ทุกวัน', shipping_type: 'ควบคุมอุณหภูมิ',
      description: 'แป้งชูกรอบบาง สอดไส้ดิโพลแมทครีมหอมกลิ่นฝักวานิลลาแท้จากมาดากัสการ์ ไส้แน่นทะลักเต็มปากเต็มคำ',
      image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600',
      stock_quantity: 5
    },

    // Shop 8: Golden Fruit & Healthy Farm (3 items)
    {
      shop_id: 8, category_id: 3,
      name: 'สตรอว์เบอร์รีเกาหลีคิงส์เบอร์รี่สดตัดแต่งพร้อมทาน (กล่องใหญ่)',
      original_price: 280.00, discount_price: 99.00, discount_percent: 65,
      expiry_text: 'หมดอายุใน 2 ชม.',
      freshness: 'ตัดแต่งสดใหม่ แช่เย็น', shipping_type: 'ควบคุมอุณหภูมิ',
      description: 'สตรอว์เบอร์รีนำเข้าจากเกาหลี ผลใหญ่ หวานฉ่ำอมเปรี้ยว ล้างสะอาดและตัดแต่งพร้อมทานในกล่องซีลสุญญากาศ',
      image_url: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=600',
      stock_quantity: 4
    },
    {
      shop_id: 8, category_id: 3,
      name: 'องุ่นเขียวไชน์มัสคัสไร้เมล็ดคัดเกรดพรีเมียม (400g)',
      original_price: 250.00, discount_price: 89.00, discount_percent: 64,
      expiry_text: 'หมดอายุใน 3 ชม.',
      freshness: 'กรอบหวาน ฉ่ำน้ำ', shipping_type: 'ควบคุมอุณหภูมิ',
      description: 'องุ่นไซน์มัสคัสผลเต่งตึง เปลือกบางกรอบ หวานฉ่ำหอมกลิ่นเยลลี่ ลดล้างสต็อกก่อนปิดรอบประจำวัน',
      image_url: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=600',
      stock_quantity: 3
    },
    {
      shop_id: 8, category_id: 3,
      name: 'เซ็ตผลไม้รวมวิตามินซีสูง (เมล่อน ส้มสายน้ำผึ้ง กีวี่ทอง)',
      original_price: 150.00, discount_price: 49.00, discount_percent: 67,
      expiry_text: 'หมดอายุใน 1 ชม. 30 นาที',
      freshness: 'หั่นสดพร้อมทาน', shipping_type: 'ควบคุมอุณหภูมิ',
      description: 'รวมผลไม้วิตามินซีสูง สดชื่น ปอกและหั่นพร้อมทาน สะอาดถูกหลักอนามัย อิ่มเบาสบายท้อง',
      image_url: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600',
      stock_quantity: 5
    }
  ];

  for (const p of productsList) {
    await db.query(
      `INSERT INTO products (
        shop_id, category_id, name, original_price, discount_price, 
        discount_percent, expiry_text, freshness, shipping_type, 
        description, image_url, stock_quantity, is_auction
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        p.shop_id, p.category_id, p.name, p.original_price, p.discount_price,
        p.discount_percent, p.expiry_text, p.freshness, p.shipping_type,
        p.description, p.image_url, p.stock_quantity
      ]
    );
  }

  // 4. Update and Refresh Auctions with Active Timers and Exciting Bids
  console.log('--- Step 4: Seeding & Refreshing Active Live Auctions ---');
  await db.query('DELETE FROM auction_bids');
  await db.query('DELETE FROM auctions');

  const now = new Date();
  const endTime1 = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hrs from now
  const endTime2 = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hrs from now
  const endTime3 = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hrs from now

  const auctionsList = [
    {
      auction_id: 1,
      title: 'ชุดซูชิรวมพรีเมียม โอโทโร่ & อูนิ (ใกล้หมดอายุ)',
      description: 'ดื่มด่ำกับรสชาติญี่ปุ่นแท้ๆ ด้วยชุดซูชิรวมพรีเมียม คัดสรรวัตถุดิบนำเข้าจากญี่ปุ่น ทั้งโอโทโร่ อูนิ และโฮตาเตะ สดใหม่ทุกคำ จัดเตรียมโดยเชฟผู้เชี่ยวชาญ (ควรบริโภคทันทีเพื่อรสชาติที่ดีที่สุด)',
      image_url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800',
      shop_id: 4,
      shop_name: 'Sushiro Central World ชั้น 6',
      start_price: 89.00,
      current_bid: 149.00,
      min_increment: 10.00,
      original_price: 490.00,
      discount_percent: 70,
      end_time: endTime1,
      auction_status: 'active'
    },
    {
      auction_id: 2,
      title: 'เค้กมาการองเซ็ตพรีเมียม 12 ชิ้น (คอลเลกชันพิเศษ)',
      description: 'มาการองรสชาติยอดนิยม 12 ชิ้น ทั้งราสเบอร์รี่ พิสตาชิโอ ช็อกโกแลตฟรังบัวส์ และวานิลลา หวานกลมกล่อม ทำสดใหม่ประจำวัน ลดล้างสต็อกรอบค่ำ',
      image_url: 'https://images.unsplash.com/photo-1569864358642-9d1684040f43?w=800',
      shop_id: 2,
      shop_name: "Paul's French Bakery & Patisserie",
      start_price: 99.00,
      current_bid: 160.00,
      min_increment: 20.00,
      original_price: 550.00,
      discount_percent: 71,
      end_time: endTime2,
      auction_status: 'active'
    },
    {
      auction_id: 3,
      title: 'สเต็กเนื้อวากิวออสเตรเลีย Ribeye A5 ดรายเอจ',
      description: 'เนื้อสเต็กริบอายวากิว A5 นุ่มละมุน ลายหินอ่อนสวยงาม หมักเครื่องเทศสมุนไพรพร้อมปรุงหรือย่างระดับ Medium Rare กลิ่นหอมเย้ายวนใจ',
      image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
      shop_id: 1,
      shop_name: 'Zen Japanese Restaurant (สุขุมวิท 21)',
      start_price: 150.00,
      current_bid: 280.00,
      min_increment: 20.00,
      original_price: 890.00,
      discount_percent: 68,
      end_time: endTime3,
      auction_status: 'active'
    }
  ];

  for (const auc of auctionsList) {
    await db.query(
      `INSERT INTO auctions (
        auction_id, title, description, image_url, shop_id, shop_name,
        start_price, current_bid, min_increment, original_price, discount_percent,
        end_time, auction_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auc.auction_id, auc.title, auc.description, auc.image_url, auc.shop_id, auc.shop_name,
        auc.start_price, auc.current_bid, auc.min_increment, auc.original_price, auc.discount_percent,
        auc.end_time, auc.auction_status
      ]
    );
  }

  // Insert mock live bids for leaderboards
  const bidsData = [
    { auction_id: 1, user_id: 2, bid_amount: 149.00, bid_status: 'active' },
    { auction_id: 1, user_id: 1, bid_amount: 120.00, bid_status: 'outbid' },
    { auction_id: 1, user_id: 3, bid_amount: 99.00, bid_status: 'outbid' },
    
    { auction_id: 2, user_id: 1, bid_amount: 160.00, bid_status: 'active' },
    { auction_id: 2, user_id: 2, bid_amount: 130.00, bid_status: 'outbid' },
    
    { auction_id: 3, user_id: 2, bid_amount: 280.00, bid_status: 'active' },
    { auction_id: 3, user_id: 3, bid_amount: 220.00, bid_status: 'outbid' }
  ];

  for (const b of bidsData) {
    await db.query(
      'INSERT INTO auction_bids (auction_id, user_id, bid_amount, bid_status) VALUES (?, ?, ?, ?)',
      [b.auction_id, b.user_id, b.bid_amount, b.bid_status]
    );
  }

  console.log('✅ Database successfully enriched with rich, realistic, food-waste focused data!');
  process.exit(0);
}

seedData().catch(err => {
  console.error('❌ Error seeding data:', err);
  process.exit(1);
});
