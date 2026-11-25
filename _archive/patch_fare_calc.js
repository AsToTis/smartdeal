const fs = require('fs');
const path = require('path');

// 1. Patch cart.tsx
const cartFile = path.join(__dirname, 'smart-deal-app/src/app/cart.tsx');
let cartCode = fs.readFileSync(cartFile, 'utf8');

const updatedCartState = `  const { cart, updateQuantity, removeFromCart, clearCart, totalAmount } = useCart();
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

// 2. Patch checkout.tsx
const checkoutFile = path.join(__dirname, 'smart-deal-app/src/app/checkout.tsx');
let checkoutCode = fs.readFileSync(checkoutFile, 'utf8');

// Ensure systemFare state in checkout.tsx is initialized to 25 and updated from /api/settings
checkoutCode = checkoutCode.replace(
  /const \[systemFare, setSystemFare\] = useState\(\{ baseFee: \d+, perKmFee: \d+ \}\);/m,
  'const [systemFare, setSystemFare] = useState({ baseFee: 25, perKmFee: 8 });'
);

// Update fetchUserAddressAndCoupons to setSystemFare
const settingsFetchLogic = `      // ดึงการตั้งค่าระบบ (ค่าจัดส่งเริ่มต้น)
      try {
        const settingsRes = await axios.get(\`\${BASE_URL}/settings\`);
        if (settingsRes.data?.success) {
          const base = Number(settingsRes.data.base_delivery_fee) || 25;
          const perKm = Number(settingsRes.data.per_km_fee) || 8;
          setSystemFare({ baseFee: base, perKmFee: perKm });
          setSystemBaseDeliveryFee(base);
          if (settingsRes.data.minimum_order_value !== undefined) {
            setSystemMinOrderValue(Number(settingsRes.data.minimum_order_value));
          }
        }
      } catch (e) {}

      // ดึงคูปองสะสมของผู้ใช้
      await loadUserCoupons(userId);`;

if (checkoutCode.includes('// ดึงการตั้งค่าระบบ (ค่าจัดส่งเริ่มต้น)')) {
  checkoutCode = checkoutCode.replace(
    /\/\/ ดึงการตั้งค่าระบบ \(ค่าจัดส่งเริ่มต้น\)[\s\S]*?await loadUserCoupons\(userId\);/m,
    settingsFetchLogic
  );
}

// In checkout.tsx delivery fee calculation:
checkoutCode = checkoutCode.replace(
  /const calculatedDeliveryFare = Math\.round\(systemFare\.baseFee \+ \(estimatedDistanceKm \* systemFare\.perKmFee\)\);/m,
  'const calculatedDeliveryFare = Math.round(systemFare.baseFee);'
);

fs.writeFileSync(checkoutFile, checkoutCode, 'utf8');
console.log('✅ Updated checkout.tsx delivery fee logic');
