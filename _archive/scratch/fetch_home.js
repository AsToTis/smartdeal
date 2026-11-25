const https = require('https');

https.get('https://smartdeal-backend-vhjo.onrender.com/api/home-data', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('categories:', json.categories.slice(0, 1));
      console.log('deals:', json.deals.slice(0, 1));
      console.log('shops:', json.shops.slice(0, 1));
    } catch (e) { console.error(e); }
  });
}).on('error', console.error);
