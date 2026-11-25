const path = require('path');
const dotenv = require('dotenv');

// ค้นหาและโหลดไฟล์ .env จากพาธต่าง ๆ เพื่อรองรับการรันจากทั้ง root และ backend folder
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const mysql = require('mysql2');

// การตั้งค่าการเชื่อมต่อฐานข้อมูล Localhost XAMPP ถาวร
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'db244',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true // Fix Date serialization to return strings instead of {}
};

const db = mysql.createPool(dbConfig);

// ตรวจสอบการเชื่อมต่อ
db.getConnection((err, connection) => {
  if (err) {
    console.error(`❌ ไม่สามารถเชื่อมต่อ MySQL ได้ (${dbConfig.host}:${dbConfig.port} / ${dbConfig.database}):`, err.message);
  } else {
    console.log(`✅ เชื่อมต่อ MySQL สำเร็จ! (${dbConfig.host}:${dbConfig.port} / Database: ${dbConfig.database})`);
    connection.release();
  }
});

module.exports = db.promise();
