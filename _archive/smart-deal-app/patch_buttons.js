const fs = require('fs');

const file = 'src/app/(tabs)/orders.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix Track Status
const trackRegex = /\{getStatusInfo\(selectedOrder\?\.order_status\)\.isActive && \(/g;
if (content.match(trackRegex)) {
  content = content.replace(trackRegex, "{getStatusInfo(selectedOrder?.order_status).isActive && !['pending', 'paid'].includes(selectedOrder?.order_status) && (");
}

// Fix Reorder
const reorderRegex = /\{selectedOrder\?\.items && selectedOrder\.items\.length > 0 && \(/g;
if (content.match(reorderRegex)) {
  content = content.replace(reorderRegex, "{['completed', 'cancelled'].includes(selectedOrder?.order_status) && selectedOrder?.items && selectedOrder.items.length > 0 && (");
}

fs.writeFileSync(file, content);
console.log('Patched buttons visibility');
