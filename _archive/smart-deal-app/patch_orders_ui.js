const fs = require('fs');

function patchOrdersFrontend() {
  const file = 'src/app/(tabs)/orders.tsx';
  let content = fs.readFileSync(file, 'utf8');

  // Fix 1: Confirm Receipt Button Visibility
  const buttonRegex = /\{\['paid', 'shipped', 'pending'\]\.includes\(selectedOrder\?\.order_status\) && \(/g;
  if (content.match(buttonRegex)) {
    content = content.replace(buttonRegex, "{['shipped', 'delivered', 'ready', 'ready_for_pickup'].includes(selectedOrder?.order_status) && (");
  }

  // Fix 2: Image fallback
  const imgFallbackRegex = /const getOrderImage = \(order: any\) => \{[\s\S]*?return 'https:\/\/images\.unsplash\.com\/photo-1546069901-ba9599a7e63c\?w=500';\s*\};/s;
  const newImgFallback = `const getOrderImage = (order: any) => {
    if (order?.display_image && order.display_image.trim() !== '') return order.display_image;
    if (order?.shop_image && order.shop_image.trim() !== '') return order.shop_image;
    if (order?.items && order.items.length > 0 && order.items[0].product_image && order.items[0].product_image.trim() !== '') {
      return order.items[0].product_image;
    }
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
  };`;
  
  if (content.match(imgFallbackRegex)) {
    content = content.replace(imgFallbackRegex, newImgFallback);
  }

  fs.writeFileSync(file, content);
  console.log('Patched orders.tsx');
}

patchOrdersFrontend();
