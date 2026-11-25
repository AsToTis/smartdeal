const fs = require('fs');

const file = 'src/app/(tabs)/orders.tsx';
let content = fs.readFileSync(file, 'utf8');

const imgRegex = /const getOrderImage = \(order: any\) => \{[\s\S]*?return 'https:\/\/images\.unsplash\.com\/photo-1546069901-ba9599a7e63c\?w=500';\s*\};/s;

const newImg = `const getOrderImage = (order: any) => {
    const isValid = (img: string) => img && typeof img === 'string' && img.trim() !== '';
    if (isValid(order?.display_image)) return order.display_image;
    if (isValid(order?.shop_image)) return order.shop_image;
    if (order?.items && order.items.length > 0 && isValid(order.items[0].product_image)) {
      return order.items[0].product_image;
    }
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
  };`;

if (content.match(imgRegex)) {
  content = content.replace(imgRegex, newImg);
  fs.writeFileSync(file, content);
  console.log('Fixed getOrderImage');
}
