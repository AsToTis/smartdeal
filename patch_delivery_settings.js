const fs = require('fs');
const path = require('path');

// 1. Update server.js to expose GET /api/settings and GET /api/system-settings
const serverFile = path.join(__dirname, 'smart-deal-backend/src/server.js');
let serverCode = fs.readFileSync(serverFile, 'utf8');

const publicSettingsRoute = `// Public System Settings API for Mobile Apps
app.get('/api/settings', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT setting_key, setting_value FROM system_settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });
    res.json({
      success: true,
      settings,
      base_delivery_fee: parseFloat(settings.base_delivery_fee) || 25,
      per_km_fee: parseFloat(settings.per_km_fee) || 8,
      minimum_order_value: parseFloat(settings.minimum_order_value) || 50,
      platform_fee_percent: parseFloat(settings.platform_fee_percent) || 15,
      rider_commission_percent: parseFloat(settings.rider_commission_percent) || 90
    });
  } catch (error) {
    console.error('API /api/settings Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/system-settings', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT setting_key, setting_value FROM system_settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });
    res.json({
      success: true,
      settings,
      base_delivery_fee: parseFloat(settings.base_delivery_fee) || 25,
      per_km_fee: parseFloat(settings.per_km_fee) || 8,
      minimum_order_value: parseFloat(settings.minimum_order_value) || 50,
      platform_fee_percent: parseFloat(settings.platform_fee_percent) || 15,
      rider_commission_percent: parseFloat(settings.rider_commission_percent) || 90
    });
  } catch (error) {
    console.error('API /api/system-settings Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
`;

if (!serverCode.includes("app.get('/api/settings'")) {
  serverCode = serverCode.replace(
    "app.get('/api/admin/settings', async (req, res) => {",
    publicSettingsRoute + "\napp.get('/api/admin/settings', async (req, res) => {"
  );
  fs.writeFileSync(serverFile, serverCode, 'utf8');
  console.log('✅ Added GET /api/settings and GET /api/system-settings to server.js');
}

// 2. Update cart.tsx
const cartFile = path.join(__dirname, 'smart-deal-app/src/app/cart.tsx');
let cartCode = fs.readFileSync(cartFile, 'utf8');

// Ensure axios and BASE_URL are imported
if (!cartCode.includes('import axios')) {
  cartCode = cartCode.replace(
    "import { router } from 'expo-router';",
    "import { router, useFocusEffect } from 'expo-router';\nimport axios from 'axios';\nimport { BASE_URL } from '../constants/api';"
  );
}

// Replace delivery fee and add settings state
const newCartHeaderLogic = `  const { cart, updateQuantity, removeFromCart, clearCart, totalAmount } = useCart();
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(25);
  const [minOrderValue, setMinOrderValue] = useState<number>(50);

  // ดึงการตั้งค่าค่าจัดส่งจากระบบ
  useFocusEffect(
    React.useCallback(() => {
      const fetchSettings = async () => {
        try {
          const res = await axios.get(\`\${BASE_URL}/settings\`);
          if (res.data?.success) {
            if (res.data.base_delivery_fee !== undefined) {
              setDeliveryFee(Number(res.data.base_delivery_fee));
            }
            if (res.data.minimum_order_value !== undefined) {
              setMinOrderValue(Number(res.data.minimum_order_value));
            }
          }
        } catch (e) {
          console.log('Fetch settings in cart error:', e);
        }
      };
      fetchSettings();
    }, [])
  );`;

if (cartCode.includes("const { cart, updateQuantity")) {
  cartCode = cartCode.replace(
    /const \{ cart, updateQuantity, removeFromCart, clearCart, totalAmount \} = useCart\(\);\s*const \[promoCode, setPromoCode\] = useState\(''\);\s*const \[discount, setDiscount\] = useState\(0\);/m,
    newCartHeaderLogic
  );
}

// Remove hardcoded const deliveryFee = 15;
cartCode = cartCode.replace(
  /const deliveryFee = 15;\s*\/\/ ค่าจัดส่งโดยไรเดอร์/m,
  '// ค่าจัดส่งดึงตามการตั้งค่าระบบ'
);

fs.writeFileSync(cartFile, cartCode, 'utf8');
console.log('✅ Updated cart.tsx with dynamic delivery fee from system settings');

// 3. Update checkout.tsx
const checkoutFile = path.join(__dirname, 'smart-deal-app/src/app/checkout.tsx');
let checkoutCode = fs.readFileSync(checkoutFile, 'utf8');

// Replace hardcoded delivery fee logic in checkout.tsx
if (!checkoutCode.includes('systemBaseDeliveryFee')) {
  checkoutCode = checkoutCode.replace(
    /const \[currentUserId, setCurrentUserId\] = useState<number>\(2\);/m,
    `const [currentUserId, setCurrentUserId] = useState<number>(2);
  const [systemBaseDeliveryFee, setSystemBaseDeliveryFee] = useState<number>(25);
  const [systemMinOrderValue, setSystemMinOrderValue] = useState<number>(50);`
  );

  // Fetch settings in fetchUserAddressAndCoupons
  checkoutCode = checkoutCode.replace(
    /\/\/ ดึงคูปองสะสมของผู้ใช้\s*await loadUserCoupons\(userId\);/m,
    `// ดึงการตั้งค่าระบบ (ค่าจัดส่งเริ่มต้น)
      try {
        const settingsRes = await axios.get(\`\${BASE_URL}/settings\`);
        if (settingsRes.data?.success) {
          if (settingsRes.data.base_delivery_fee !== undefined) {
            setSystemBaseDeliveryFee(Number(settingsRes.data.base_delivery_fee));
          }
          if (settingsRes.data.minimum_order_value !== undefined) {
            setSystemMinOrderValue(Number(settingsRes.data.minimum_order_value));
          }
        }
      } catch (e) {}

      // ดึงคูปองสะสมของผู้ใช้
      await loadUserCoupons(userId);`
  );

  // Update deliveryFee calculation in checkout.tsx
  checkoutCode = checkoutCode.replace(
    "const deliveryFee = deliveryMethod === 'delivery' ? 15 : 0;",
    "const deliveryFee = deliveryMethod === 'delivery' ? systemBaseDeliveryFee : 0;"
  );

  checkoutCode = checkoutCode.replace(
    "const deliveryFeeText = deliveryMethod === 'delivery' ? '฿15.00' : 'ฟรี (รับเองที่ร้าน)';",
    "const deliveryFeeText = deliveryMethod === 'delivery' ? `฿${deliveryFee.toFixed(2)}` : 'ฟรี (รับเองที่ร้าน)';"
  );

  checkoutCode = checkoutCode.replace(
    "? 'ส่งฟรี (ลดค่าส่ง ฿15)'",
    "? `ส่งฟรี (ลดค่าส่ง ฿${deliveryFee.toFixed(2)})`"
  );

  checkoutCode = checkoutCode.replace(
    "setSelectedCoupon({ code: 'FREEDEL', title: 'คูปองส่งฟรี', type: 'free_delivery', value: 15 });",
    "setSelectedCoupon({ code: 'FREEDEL', title: 'คูปองส่งฟรี', type: 'free_delivery', value: deliveryFee });"
  );

  fs.writeFileSync(checkoutFile, checkoutCode, 'utf8');
  console.log('✅ Updated checkout.tsx with dynamic delivery fee from system settings');
}
