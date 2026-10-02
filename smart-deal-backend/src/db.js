require('dotenv').config();
const mysql = require('mysql2');

// รองรับทั้ง Environment Variables (เช่น บน Render) และค่า Default Localhost
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'smart_deal_db',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ตรวจสอบการเชื่อมต่อ
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ ไม่สามารถเชื่อมต่อ MySQL ได้:', err.message);
  } else {
    console.log('✅ เชื่อมต่อ MySQL สำเร็จ! (' + (process.env.DB_HOST || 'localhost') + ')');
    connection.release();
  }
});

module.exports = db.promise();
