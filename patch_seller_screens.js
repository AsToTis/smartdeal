const fs = require('fs');
const path = require('path');

// 1. Patch order-details.tsx
const orderDetailsPath = path.join(__dirname, 'smart-deal-app/src/app/(seller)/order-details.tsx');
let orderDetails = fs.readFileSync(orderDetailsPath, 'utf8');

// Fix getImageUrl in order-details.tsx
orderDetails = orderDetails.replace(
  /const getImageUrl = \(imgUrl: string\) => \{[\s\S]*?\};\n/m,
  `const getImageUrl = (imgUrl?: string) => {
    if (!imgUrl) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
    if (imgUrl.startsWith('data:') || imgUrl.startsWith('http://') || imgUrl.startsWith('https://') || imgUrl.startsWith('file://')) {
      return imgUrl;
    }
    return \`\${BASE_URL.replace('/api', '')}\${imgUrl.startsWith('/') ? '' : '/'}\${imgUrl}\`;
  };
`
);

// Fix formatThaiDateTime in order-details.tsx
orderDetails = orderDetails.replace(
  /const formatThaiDateTime = \(dateStr: string\) => \{[\s\S]*?\};\n/m,
  `const formatThaiDateTime = (dateStr: any) => {
    if (!dateStr || typeof dateStr === 'object' && Object.keys(dateStr).length === 0) return 'เมื่อสักครู่';
    try {
      const cleanStr = typeof dateStr === 'string' ? dateStr.replace(' ', 'T') : dateStr;
      const date = new Date(cleanStr);
      if (isNaN(date.getTime())) return 'เมื่อสักครู่';
      const thaiMonthsShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      return \`\${date.getDate()} \${thaiMonthsShort[date.getMonth()]} \${date.getFullYear() + 543} • \${date.getHours().toString().padStart(2, '0')}:\${date.getMinutes().toString().padStart(2, '0')}\`;
    } catch (e) {
      return 'เมื่อสักครู่';
    }
  };
`
);
fs.writeFileSync(orderDetailsPath, orderDetails, 'utf8');
console.log('✅ Patched (seller)/order-details.tsx');

// 2. Patch (seller)/index.tsx
const sellerIndexPath = path.join(__dirname, 'smart-deal-app/src/app/(seller)/index.tsx');
let sellerIndex = fs.readFileSync(sellerIndexPath, 'utf8');

// Fix getImageUrl in seller/index.tsx
sellerIndex = sellerIndex.replace(
  /const getImageUrl = \(imgUrl: string\) => \{[\s\S]*?\};\n/m,
  `const getImageUrl = (imgUrl?: string) => {
    if (!imgUrl) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
    if (imgUrl.startsWith('data:') || imgUrl.startsWith('http://') || imgUrl.startsWith('https://') || imgUrl.startsWith('file://')) {
      return imgUrl;
    }
    return \`\${BASE_URL.replace('/api', '')}\${imgUrl.startsWith('/') ? '' : '/'}\${imgUrl}\`;
  };
`
);
fs.writeFileSync(sellerIndexPath, sellerIndex, 'utf8');
console.log('✅ Patched (seller)/index.tsx');

// 3. Patch (seller)/orders.tsx if it has getImageUrl or needs image display
const sellerOrdersPath = path.join(__dirname, 'smart-deal-app/src/app/(seller)/orders.tsx');
let sellerOrders = fs.readFileSync(sellerOrdersPath, 'utf8');
if (!sellerOrders.includes('const getImageUrl')) {
  sellerOrders = sellerOrders.replace(
    /export default function SellerOrdersScreen\(\) \{/,
    `export default function SellerOrdersScreen() {
  const getImageUrl = (imgUrl?: string) => {
    if (!imgUrl) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
    if (imgUrl.startsWith('data:') || imgUrl.startsWith('http://') || imgUrl.startsWith('https://') || imgUrl.startsWith('file://')) {
      return imgUrl;
    }
    return \`\${BASE_URL.replace('/api', '')}\${imgUrl.startsWith('/') ? '' : '/'}\${imgUrl}\`;
  };
`
  );
  fs.writeFileSync(sellerOrdersPath, sellerOrders, 'utf8');
  console.log('✅ Added getImageUrl to (seller)/orders.tsx');
}
