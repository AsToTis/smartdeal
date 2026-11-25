const fs = require('fs');

function fixTrackApi3() {
  const file = 'src/server.js';
  let content = fs.readFileSync(file, 'utf8');

  const oldReturn = `          delivery_lng: o.delivery_lng ? parseFloat(o.delivery_lng) : null,
          shipping_address: o.shipping_address,
          note_for_rider: o.note_for_rider
        },`;
  
  const newReturn = `          delivery_lng: o.delivery_lng ? parseFloat(o.delivery_lng) : null,
          shipping_address: o.shipping_address,
          receiver_name: o.receiver_name,
          receiver_phone: o.receiver_phone,
          note_for_rider: o.note_for_rider
        },`;
  
  if (content.includes(oldReturn)) {
    content = content.replace(oldReturn, newReturn);
    fs.writeFileSync(file, content);
    console.log('Fixed track API');
  } else {
    console.log('Could not find the block to replace');
  }
}

fixTrackApi3();
