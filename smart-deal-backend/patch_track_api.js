const fs = require('fs');

function patchTrackingBackend() {
  const file = 'src/server.js';
  let content = fs.readFileSync(file, 'utf8');

  const oldCode = `        shipping_address: o.shipping_address,
        note_for_rider: o.note_for_rider
      },`;
      
  const newCode = `        shipping_address: o.shipping_address,
        receiver_name: o.receiver_name,
        receiver_phone: o.receiver_phone,
        note_for_rider: o.note_for_rider
      },`;

  if (content.includes('shipping_address: o.shipping_address,')) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(file, content);
    console.log('Patched tracking backend');
  }
}

patchTrackingBackend();
