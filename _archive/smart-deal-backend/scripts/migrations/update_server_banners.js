const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const initBannersTableStr = `const initBannersTable = async () => {
  try {
    await db.execute(\`
      CREATE TABLE IF NOT EXISTS banners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        image_url VARCHAR(255) NOT NULL,
        link_url VARCHAR(255),
        title VARCHAR(255),
        subtitle VARCHAR(255),
        badge_text VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    \`);
    
    const [rows] = await db.execute('SELECT COUNT(*) as count FROM banners');
    if (rows[0].count === 0) {
      await db.execute(\`
        INSERT INTO banners (image_url, link_url, title, subtitle, badge_text, is_active) VALUES 
        ('https://images.unsplash.com/photo-1555244162-803834f70033?w=800', 'https://www.google.com', 'ประหยัดสูงสุด 70% กับอาหารสดส่วนเกิน!', 'ช่วยลดขยะอาหารและเพลิดเพลินกับอาหารพรีเมียมในราคาสุดคุ้ม', 'ดีลสายฟ้าแลบ', true),
        ('https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800', 'https://www.google.com', 'ลดกระหน่ำมื้อค่ำ 50%', 'อาหารอร่อยจากร้านดังใกล้คุณ ลดราคาสุดพิเศษ', 'Flash Sale', true)
      \`);
    }
    console.log('✅ ตรวจสอบ/สร้างตาราง banners สำเร็จ');
  } catch (err) {
    console.error('❌ ไม่สามารถสร้างตาราง banners ได้:', err.message);
  }
};
initBannersTable();
`;

// Insert the table initialization near initOrderMessagesTable
if (!code.includes('initBannersTable')) {
  code = code.replace("initOrderMessagesTable();", "initOrderMessagesTable();\n" + initBannersTableStr);
}

const bannerApi = `
// ==========================================
// BANNER APIs
// ==========================================
app.get('/api/banners', async (req, res) => {
  try {
    const [banners] = await db.query('SELECT * FROM banners WHERE is_active = true ORDER BY id ASC');
    res.json({ success: true, banners });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({ success: false, message: 'ไม่สามารถดึงแบนเนอร์ได้' });
  }
});
`;

if (!code.includes('/api/banners')) {
  code = code.replace("app.listen(PORT,", bannerApi + "\napp.listen(PORT,");
}

fs.writeFileSync('server.js', code);
console.log('Banners API inserted');
