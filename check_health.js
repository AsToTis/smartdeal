async function checkDeploy() {
  try {
    const res = await fetch('https://smartdeal-backend-vhjo.onrender.com/api/health');
    console.log('Health Status:', res.status, await res.text());
  } catch (err) {
    console.error('Health error:', err.message);
  }
}
checkDeploy();
