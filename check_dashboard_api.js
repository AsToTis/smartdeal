async function checkSellerDashboard() {
  try {
    const res2 = await fetch('https://smartdeal-backend-vhjo.onrender.com/api/seller/dashboard/1');
    const json2 = await res2.json();
    const ro = json2.recentOrders?.[0];
    console.log('recentOrders[0]:', ro);
    for (const k in ro) {
      console.log(`${k}:`, typeof ro[k] === 'string' && ro[k].length > 80 ? ro[k].slice(0, 80) + '...' : ro[k]);
    }
  } catch (e) {
    console.error(e);
  }
}

checkSellerDashboard();
