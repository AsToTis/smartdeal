const baseUrl = 'https://smartdeal-backend-vhjo.onrender.com';

const fixUrls = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(fixUrls);
  }
  const newObj = { ...obj };
  for (const key in newObj) {
    if (typeof newObj[key] === 'string' && (key.includes('image') || key.includes('url') || key.includes('avatar') || key.includes('qr'))) {
      if (newObj[key].startsWith('/uploads')) {
        newObj[key] = baseUrl + newObj[key];
      }
    } else if (typeof newObj[key] === 'object') {
      newObj[key] = fixUrls(newObj[key]);
    }
  }
  return newObj;
};

const data = {
  success: true,
  categories: [{ id: 1, image_url: '/uploads/cat1.jpg' }],
  deals: [{ id: 1, image: 'https://other.com/1.jpg', shop_image: '/uploads/shop.png' }]
};

console.log(JSON.stringify(fixUrls(data), null, 2));
