async function pollRender() {
  console.log('Polling Render deploy status...');
  for (let i = 1; i <= 15; i++) {
    try {
      const res = await fetch('https://smartdeal-backend-vhjo.onrender.com/api/points/2');
      console.log(`[Attempt ${i}] Status: ${res.status}`);
      if (res.status === 200) {
        const data = await res.json();
        console.log('Points response:', data);

        // Now test redeem
        const redeemRes = await fetch('https://smartdeal-backend-vhjo.onrender.com/api/points/redeem', {
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
        console.log('Redeem Status:', redeemRes.status);
        if (redeemRes.status === 200) {
          const redeemData = await redeemRes.json();
          console.log('🎉 Redeem Success Data:', redeemData);
          break;
        } else {
          const text = await redeemRes.text();
          console.log('Redeem not ready yet:', text.slice(0, 100));
        }
      }
    } catch (e) {
      console.log(`[Attempt ${i}] Error:`, e.message);
    }
    await new Promise(r => setTimeout(r, 6000));
  }
}

pollRender();
