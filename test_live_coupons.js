async function testCoupons() {
  try {
    const res = await fetch('https://smartdeal-backend-vhjo.onrender.com/api/coupons/2');
    console.log('GET coupons status:', res.status);
    const json = await res.json();
    console.log('Coupons for user 2:', JSON.stringify(json, null, 2));

    const pointsRes = await fetch('https://smartdeal-backend-vhjo.onrender.com/api/points/2');
    const pointsJson = await pointsRes.json();
    console.log('Current points for user 2:', JSON.stringify(pointsJson, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testCoupons();
