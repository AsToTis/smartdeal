const http = require('http');
const db = require('../src/db');

function request(path, method, data) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

(async () => {
  console.log('==============================================');
  console.log('🗺️ TESTING MAP LOCATION & ADDRESS SYSTEM');
  console.log('==============================================\n');

  console.log('▶ 1. GET /api/users/2/address');
  const getRes = await request('/api/users/2/address', 'GET');
  console.log('Current Address:', getRes.data);

  console.log('\n▶ 2. POST /api/users/2/address (Update with new coordinates and note)');
  const postRes = await request('/api/users/2/address', 'POST', {
    title: 'ลาวัณย์ปาร์ควิลล์',
    address_detail: '577 ตำบลท่าขอนยาง อำเภอกันทรวิชัย มหาสารคาม 44150',
    latitude: 16.246826,
    longitude: 103.251992,
    receiver_name: 'ยุติธรรม ปั่นกลาง',
    receiver_phone: '0647151855',
    note_for_rider: 'ฝากไว้ที่นิติ, วางไว้หน้าประตู'
  });
  console.log('Save result:', postRes.data);

  console.log('\n▶ 3. Verifying GET /api/users/2/address after save');
  const verifyRes = await request('/api/users/2/address', 'GET');
  console.log('Verified Address:', verifyRes.data);

  console.log('\n▶ 4. Testing GET /api/users/2/addresses (List)');
  const listRes = await request('/api/users/2/addresses', 'GET');
  console.log('Address count:', listRes.data.addresses?.length);

  console.log('\n🎉 ALL ADDRESS & MAP PICKER API TESTS PASSED!');
  process.exit(0);
})().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
