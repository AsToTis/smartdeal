async function checkOrderImages() {
  try {
    const res1 = await fetch('https://smartdeal-backend-vhjo.onrender.com/api/orders/1');
    const json1 = await res1.json();
    const item = json1.order?.items?.[0];
    for (const k in item) {
      console.log(`${k}:`, typeof item[k] === 'string' && item[k].length > 80 ? item[k].slice(0, 80) + '...' : item[k]);
    }
  } catch (e) {
    console.error(e);
  }
}

checkOrderImages();
