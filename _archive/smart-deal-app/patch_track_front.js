const fs = require('fs');

function patchTrackingFrontend() {
  const file = 'src/app/tracking.tsx';
  let content = fs.readFileSync(file, 'utf8');

  // Fix Shop Address fallback (it can stay as shop?.address, but remove the long hardcoded string if possible, or leave it)
  // But wait, what about the customer phone?
  const custDescRegex = /<Text style=\{styles\.locationDesc\}>ลูกค้า \- \(\+66\) 080 000 0000<\/Text>/g;
  
  if (content.match(custDescRegex)) {
    content = content.replace(custDescRegex, "<Text style={styles.locationDesc}>{order?.receiver_name || 'ลูกค้า'} - {order?.receiver_phone || ''}</Text>");
  }

  // Same for shop address, to make it less obviously fake if empty:
  const shopAddrRegex = /<Text style=\{styles\.locationDesc\}>\{shop\?\.address \|\| 'ถ\.นครสวรรค์ ต\.ตลาด อ\.เมือง จ\.มหาสารคาม'\}<\/Text>/g;
  if (content.match(shopAddrRegex)) {
    content = content.replace(shopAddrRegex, "<Text style={styles.locationDesc}>{shop?.address || 'ไม่มีข้อมูลที่อยู่'}</Text>");
  }

  fs.writeFileSync(file, content);
  console.log('Patched tracking.tsx');
}

patchTrackingFrontend();
