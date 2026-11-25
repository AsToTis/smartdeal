const fs = require('fs');

function patchCustomerApp() {
  const fileOrders = 'src/app/(tabs)/orders.tsx';
  let contentOrders = fs.readFileSync(fileOrders, 'utf8');

  // Fix the "ได้รับสินค้าแล้ว" button condition
  const oldBtnCondition = /\{\['shipped', 'delivered', 'ready', 'ready_for_pickup'\]\.includes\(selectedOrder\?\.order_status\) && \(/g;
  if (contentOrders.match(oldBtnCondition)) {
    contentOrders = contentOrders.replace(oldBtnCondition, "{['delivered', 'ready_for_pickup'].includes(selectedOrder?.order_status) && (");
    fs.writeFileSync(fileOrders, contentOrders);
    console.log('Patched orders.tsx confirm button condition');
  } else {
    console.log('orders.tsx condition not matched');
  }

  const fileTracking = 'src/app/tracking.tsx';
  let contentTracking = fs.readFileSync(fileTracking, 'utf8');

  // Fix the getStatusIndex function
  const oldStatusIndex = /const getStatusIndex = \(status: string\) => \{[\s\S]*?return idx === -1 \? 0 : idx;\s*\};/g;
  const newStatusIndex = `const getStatusIndex = (status: string) => {
    if (['pending', 'paid'].includes(status)) return 0;
    if (['preparing'].includes(status)) return 1;
    if (['ready'].includes(status)) return 2;
    if (['finding_rider', 'heading_to_shop', 'shipped'].includes(status)) return 3;
    if (['delivering'].includes(status)) return 4;
    if (['completed', 'delivered'].includes(status)) return 5;
    return 0;
  };`;

  if (contentTracking.match(oldStatusIndex)) {
    contentTracking = contentTracking.replace(oldStatusIndex, newStatusIndex);
    fs.writeFileSync(fileTracking, contentTracking);
    console.log('Patched tracking.tsx status index');
  } else {
    console.log('tracking.tsx status index not matched');
  }
}

patchCustomerApp();
