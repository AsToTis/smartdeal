const mysql = require('mysql2');

// สร้าง Pool สำหรับจัดการการเชื่อมต่อฐานข้อมูล
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',          // ค่าเริ่มต้นของ XAMPP
  password: '',          // ค่าเริ่มต้นของ XAMPP จะไม่มีรหัสผ่าน
  database: 'smart_deal_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ทดสอบการเชื่อมต่อ
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ ไม่สามารถเชื่อมต่อ MySQL ได้:', err.message);
  } else {
    console.log('✅ เชื่อมต่อ MySQL ใน XAMPP สำเร็จ!');
    connection.release();
  }
});

module.exports = db.promise(); // ส่งออกเป็น Promise เพื่อให้เขียนโค้ด async/await ได้ง่าย