// เซิร์ฟเวอร์ Localhost / Wi-Fi IP (สำหรับใช้งานผ่าน Expo บนมือถือ)
// เปลี่ยนเซิร์ฟเวอร์ได้โดยไม่ต้องแก้โค้ด: สร้างไฟล์ smart-deal-app/.env.local แล้วใส่
//   EXPO_PUBLIC_API_URL=http://<IP หรือโดเมน>:5000
// ถ้าไม่ได้ตั้ง จะใช้ IP เดิมด้านล่าง
const IP_ADDRESS = '192.168.0.68';
const ENV_SERVER_URL = process.env.EXPO_PUBLIC_API_URL;
export const SERVER_URL = (ENV_SERVER_URL && ENV_SERVER_URL.replace(/\/+$/, '').replace(/\/api$/, '')) || `http://${IP_ADDRESS}:5000`;
export const BASE_URL = `${SERVER_URL}/api`;
