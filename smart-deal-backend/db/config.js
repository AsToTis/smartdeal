// ==========================================================
// Smart Deal - Database configuration (Dual-Environment)
// ----------------------------------------------------------
// เลือกฐานข้อมูลด้วยตัวแปร DB_PROFILE ในไฟล์ .env
//   DB_PROFILE=local   -> ใช้ค่า DB_LOCAL_*  (XAMPP ในเครื่อง)
//   DB_PROFILE=remote  -> ใช้ค่า DB_REMOTE_* (เซิร์ฟเวอร์อาจารย์ / ภายนอก)
// ถ้าไม่ได้ตั้ง DB_PROFILE จะใช้ค่า DB_HOST / DB_USER / ... แบบเดิม (backward compatible)
// ==========================================================
const path = require('path');
const dotenv = require('dotenv');

// โหลด .env จาก root ของ smartdeal ก่อน แล้วค่อย fallback ไปที่ backend (ค่าแรกที่เจอมีผล)
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
dotenv.config({ quiet: true });

const pick = (...keys) => {
  for (const k of keys) {
    if (process.env[k] !== undefined && process.env[k] !== '') return process.env[k];
  }
  return undefined;
};

const resolveDbConfig = () => {
  const profile = (process.env.DB_PROFILE || '').trim().toLowerCase();
  const P = profile === 'remote' ? 'DB_REMOTE_' : profile === 'local' ? 'DB_LOCAL_' : null;

  const get = (name, fallback) => {
    const v = P ? pick(P + name, 'DB_' + name) : pick('DB_' + name);
    return v !== undefined ? v : fallback;
  };

  // รหัสผ่านว่างเป็นค่าที่ถูกต้องของ XAMPP จึงต้องเช็ก undefined แยกต่างหาก
  const passKey = P ? (process.env[P + 'PASSWORD'] !== undefined ? P + 'PASSWORD' : 'DB_PASSWORD') : 'DB_PASSWORD';
  const password = process.env[passKey] !== undefined ? process.env[passKey] : '';

  const sslFlag = String(get('SSL', 'false')).toLowerCase();
  const ssl = ['true', '1', 'yes', 'required'].includes(sslFlag)
    ? { rejectUnauthorized: String(get('SSL_REJECT_UNAUTHORIZED', 'false')).toLowerCase() === 'true' }
    : undefined;

  return {
    profile: profile || 'default',
    host: get('HOST', 'localhost'),
    user: get('USER', 'root'),
    password,
    database: get('NAME', 'db244'),
    port: parseInt(get('PORT', '3306'), 10),
    ssl,
    timezone: process.env.DB_TIMEZONE || 'local',
    autoMigrate: String(process.env.DB_AUTO_MIGRATE || 'true').toLowerCase() !== 'false',
    // บางเซิร์ฟเวอร์ไม่ให้สิทธิ์ CREATE DATABASE จึงเปิด/ปิดได้
    createDatabase: String(process.env.DB_CREATE_DATABASE || (profile === 'remote' ? 'false' : 'true')).toLowerCase() === 'true',
  };
};

module.exports = { resolveDbConfig };
