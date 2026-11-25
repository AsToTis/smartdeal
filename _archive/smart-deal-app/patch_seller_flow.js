const fs = require('fs');

function patchSellerOrderDetails() {
  const file = 'src/app/(seller)/order-details.tsx';
  let content = fs.readFileSync(file, 'utf8');

  // Change handleUpdateStatus('delivering') to handleUpdateStatus('shipped')
  const deliveringRegex = /handleUpdateStatus\('delivering'\)/g;
  if (content.match(deliveringRegex)) {
    content = content.replace(deliveringRegex, "handleUpdateStatus('shipped')");
    fs.writeFileSync(file, content);
    console.log('Patched seller order-details');
  } else {
    console.log('Target not found in seller order-details');
  }
}

patchSellerOrderDetails();
