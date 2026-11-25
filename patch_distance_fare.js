const fs = require('fs');
const path = require('path');

// 1. Patch server.js to calculate delivery fee using shop's real lat/lng in POST /api/orders
const serverFile = path.join(__dirname, 'smart-deal-backend/src/server.js');
let serverCode = fs.readFileSync(serverFile, 'utf8');

const orderDeliveryFareLogic = `    // 2. ตรวจสอบและคำนวณค่าจัดส่งตามระยะทางจริงและโครงสร้างระบบ
    const config = await getDeliveryFareConfig();
    let shopLat = 0, shopLng = 0;
    try {
      const [shopRows] = await connection.query('SELECT latitude, longitude FROM shops WHERE shop_id = ?', [shop_id || 1]);
      if (shopRows.length > 0) {
        shopLat = parseFloat(shopRows[0].latitude) || 0;
        shopLng = parseFloat(shopRows[0].longitude) || 0;
      }
    } catch (e) {}

    const distKm = calculateDistanceKm(shopLat, shopLng, latitude, longitude);
    const fareInfo = computeFare(distKm, config.baseFee, config.perKmFee, config.riderSharePercent);

    let calculatedDeliveryFee = parseFloat(delivery_fee) || 0;
    if (delivery_type === 'delivery' && calculatedDeliveryFee <= 0) {
      calculatedDeliveryFee = fareInfo.totalFare;
    }`;

if (serverCode.includes("// 2. ตรวจสอบและคำนวณค่าจัดส่งตามโครงสร้างระบบ")) {
  serverCode = serverCode.replace(
    /\/\/ 2\. ตรวจสอบและคำนวณค่าจัดส่งตามโครงสร้างระบบ[\s\S]*?calculatedDeliveryFee = config\.baseFee \+ \(distKm \* config\.perKmFee\);\s*\}/m,
    orderDeliveryFareLogic
  );
  fs.writeFileSync(serverFile, serverCode, 'utf8');
  console.log('✅ Updated POST /api/orders delivery fare calculation in server.js');
}

// 2. Patch checkout.tsx with real distance calculation between shop and customer
const checkoutFile = path.join(__dirname, 'smart-deal-app/src/app/checkout.tsx');
let checkoutCode = fs.readFileSync(checkoutFile, 'utf8');

// Add calculateDistanceKm helper in checkout.tsx
const distanceHelper = `function calculateDistanceKm(lat1: any, lon1: any, lat2: any, lon2: any): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 1.2;
  const p1 = parseFloat(lat1), p2 = parseFloat(lon1), p3 = parseFloat(lat2), p4 = parseFloat(lon2);
  if (isNaN(p1) || isNaN(p2) || isNaN(p3) || isNaN(p4) || (p1 === 0 && p2 === 0)) return 1.2;
  const R = 6371;
  const dLat = (p3 - p1) * (Math.PI / 180);
  const dLon = (p4 - p2) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1 * (Math.PI / 180)) * Math.cos(p3 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.max(0.5, Math.round(d * 10) / 10);
}
`;

if (!checkoutCode.includes('function calculateDistanceKm')) {
  checkoutCode = checkoutCode.replace(
    'export default function CheckoutScreen() {',
    distanceHelper + '\nexport default function CheckoutScreen() {'
  );
}

// Add shopCoords state in checkout.tsx
if (!checkoutCode.includes('shopCoords')) {
  checkoutCode = checkoutCode.replace(
    'const [systemBaseDeliveryFee, setSystemBaseDeliveryFee] = useState<number>(25);',
    `const [systemBaseDeliveryFee, setSystemBaseDeliveryFee] = useState<number>(25);
  const [shopCoords, setShopCoords] = useState<{ latitude: number; longitude: number }>({ latitude: 0, longitude: 0 });`
  );
}

// Fetch shop coordinates in fetchUserAddressAndCoupons
const fetchShopCoordsLogic = `      // ดึงพิกัดของร้านค้าเพื่อคำนวณระยะทางจริง
      const currentShopId = cartItems[0]?.shop_id || 1;
      try {
        const shopRes = await axios.get(\`\${BASE_URL}/shops/\${currentShopId}\`);
        if (shopRes.data?.success && shopRes.data?.shop) {
          setShopCoords({
            latitude: parseFloat(shopRes.data.shop.latitude) || 0,
            longitude: parseFloat(shopRes.data.shop.longitude) || 0
          });
        }
      } catch (e) {}`;

if (!checkoutCode.includes('// ดึงพิกัดของร้านค้าเพื่อคำนวณระยะทางจริง')) {
  checkoutCode = checkoutCode.replace(
    'await loadUserCoupons(userId);',
    `await loadUserCoupons(userId);\n${fetchShopCoordsLogic}`
  );
}

// Update calculatedDeliveryFare in checkout.tsx to use real distance
const dynamicFareCalc = `  // คำนวณระยะทางจริงจากร้านค้าไปยังที่อยู่จัดส่งของลูกค้า
  const currentDistanceKm = calculateDistanceKm(
    shopCoords.latitude || 16.2468,
    shopCoords.longitude || 103.2523,
    address?.latitude || 16.2400,
    address?.longitude || 103.2500
  );
  const calculatedDeliveryFare = Math.round((systemFare.baseFee + (currentDistanceKm * systemFare.perKmFee)) * 100) / 100;
  const deliveryFee = deliveryMethod === 'delivery' ? calculatedDeliveryFare : 0;`;

checkoutCode = checkoutCode.replace(
  /\/\/ โครงสร้างค่าจัดส่งตาม System Control Panel[\s\S]*?const deliveryFee = deliveryMethod === 'delivery' \? calculatedDeliveryFare : 0;/m,
  dynamicFareCalc
);

// Update deliveryFeeText to show distance
checkoutCode = checkoutCode.replace(
  /const deliveryFeeText = deliveryMethod === 'delivery' \? `฿\$\{deliveryFee\.toFixed\(2\)\}` : 'ฟรี \(รับเองที่ร้าน\)';/m,
  "const deliveryFeeText = deliveryMethod === 'delivery' ? `฿${deliveryFee.toFixed(2)} (~${currentDistanceKm} กม.)` : 'ฟรี (รับเองที่ร้าน)';"
);

fs.writeFileSync(checkoutFile, checkoutCode, 'utf8');
console.log('✅ Updated checkout.tsx with real distance-based delivery fare calculation');
