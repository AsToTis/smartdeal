const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../smart-deal-backend/src/server.js');
let code = fs.readFileSync(filePath, 'utf8');

const target = "app.post('/api/reviews', async (req, res) => {";
if (!code.includes(target)) {
  console.error("Target not found!");
  process.exit(1);
}

const newRoute = `// 0. อัปโหลดรูปภาพรีวิว
app.post('/api/reviews/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'กรุณาแนบไฟล์รูปภาพ' });
    }
    const imageUrl = '/uploads/' + req.file.filename;
    res.json({ success: true, image_url: imageUrl });
  } catch (error) {
    console.error('Upload review image error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

`;

code = code.replace(target, newRoute + target);
fs.writeFileSync(filePath, code, 'utf8');
console.log("Successfully patched /api/reviews/upload into server.js");
