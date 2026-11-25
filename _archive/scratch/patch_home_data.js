const fs = require('fs');
const file = 'c:/smartdeal/smart-deal-backend/src/server.js';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('s.rating AS shop_rating')) {
  content = content.replace(
    "s.name AS shop_name,\n        s.image_url AS shop_image,\n        IFNULL(s.is_open, 1) AS is_open",
    "s.name AS shop_name,\n        s.image_url AS shop_image,\n        s.rating AS shop_rating,\n        IFNULL(s.is_open, 1) AS is_open"
  );
  content = content.replace(
    "s.name AS shop_name,\r\n        s.image_url AS shop_image,\r\n        IFNULL(s.is_open, 1) AS is_open",
    "s.name AS shop_name,\r\n        s.image_url AS shop_image,\r\n        s.rating AS shop_rating,\r\n        IFNULL(s.is_open, 1) AS is_open"
  );
  
  content = content.replace(
    "shop_name: p.shop_name || 'ร้านค้าพรีเมียม',",
    "shop_name: p.shop_name || 'ร้านค้าพรีเมียม',\n          shop_rating: p.shop_rating,"
  );
  content = content.replace(
    "shop_name: p.shop_name || 'ร้านค้าพรีเมียม',\r\n",
    "shop_name: p.shop_name || 'ร้านค้าพรีเมียม',\r\n          shop_rating: p.shop_rating,\r\n"
  );
}

fs.writeFileSync(file, content, 'utf8');
console.log('Patched server.js for shop_rating in home-data');
