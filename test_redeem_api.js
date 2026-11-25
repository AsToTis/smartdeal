async function testRedeem() {
  try {
    const res = await fetch('https://smartdeal-backend-vhjo.onrender.com/api/points/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 2,
        cost: 500,
        code: 'DISCOUNT50',
        title: 'ส่วนลด 50 บาท',
        type: 'discount',
        value: 50
      })
    });
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('Data:', json);
  } catch (err) {
    console.error('Error message:', err.message);
  }
}

testRedeem();
