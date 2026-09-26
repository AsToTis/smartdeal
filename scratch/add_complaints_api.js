const fs = require('fs');
const path = require('path');

const serverPath = 'c:\\smartdeal\\smart-deal-backend\\src\\server.js';
let content = fs.readFileSync(serverPath, 'utf8');

// 1. Add initComplaintsTable
const initComplaints = `
const initComplaintsTable = async () => {
  try {
    await db.execute(\`
      CREATE TABLE IF NOT EXISTS complaints (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        image_url VARCHAR(255),
        status ENUM('pending', 'in_progress', 'resolved') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    \`);
  } catch (err) {
    console.error('❌ Error creating complaints table:', err.message);
  }
};
initComplaintsTable();
`;

if (!content.includes('CREATE TABLE IF NOT EXISTS complaints')) {
  content = content.replace('initOrderMessagesTable();', 'initOrderMessagesTable();\n' + initComplaints);
}

// 2. Add endpoint POST /api/complaints
const endpoint = `
// ==========================================
// Complaints API
// ==========================================
app.post('/api/complaints', upload.single('image'), async (req, res) => {
  const { user_id, subject, message } = req.body;
  const image_url = req.file ? \`/uploads/\${req.file.filename}\` : null;

  try {
    const [result] = await db.execute(
      'INSERT INTO complaints (user_id, subject, message, image_url) VALUES (?, ?, ?, ?)',
      [user_id, subject, message, image_url]
    );
    res.json({ success: true, message: 'ส่งข้อร้องเรียนสำเร็จ', complaint_id: result.insertId });
  } catch (error) {
    console.error('Error submitting complaint:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการส่งข้อร้องเรียน' });
  }
});
`;

if (!content.includes('/api/complaints')) {
  content = content.replace('// 1. AUTHENTICATION & USERS', endpoint + '\n// 1. AUTHENTICATION & USERS');
}

fs.writeFileSync(serverPath, content);
console.log('Added complaints table and API');
