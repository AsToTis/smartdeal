const fs = require('fs');

function fixTrackApi() {
  const file = 'src/server.js';
  let content = fs.readFileSync(file, 'utf8');

  const oldSQL = "SELECT o.*, s.shop_name, s.address AS shop_address, s.latitude AS shop_lat, s.longitude AS shop_lng,";
  const newSQL = "SELECT o.*, o.receiver_name, o.receiver_phone, s.shop_name, s.address AS shop_address, s.latitude AS shop_lat, s.longitude AS shop_lng,";
  
  if (content.includes(oldSQL)) {
    content = content.replace(oldSQL, newSQL);
  }

  const oldReturn = `        shipping_address: o.shipping_address,
        note_for_rider: o.note_for_rider`;
  const newReturn = `        shipping_address: o.shipping_address,
        receiver_name: o.receiver_name,
        receiver_phone: o.receiver_phone,
        note_for_rider: o.note_for_rider`;
  
  content = content.replace(oldReturn, newReturn);
  
  fs.writeFileSync(file, content);
  console.log('Fixed track API');
}

fixTrackApi();
