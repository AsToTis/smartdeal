async function checkSettings() {
  try {
    const res = await fetch('https://smartdeal-backend-vhjo.onrender.com/api/admin/settings');
    const json = await res.json();
    console.log('Settings:', JSON.stringify(json, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkSettings();
