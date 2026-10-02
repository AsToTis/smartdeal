const fs = require('fs');
const content = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8');
const newRoute = `
app.post('/api/seller/settings/:shop_id/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    const imageUrl = '/uploads/' + req.file.filename;
    await db.execute('UPDATE shops SET image_url = ? WHERE shop_id = ?', [imageUrl, req.params.shop_id]);
    res.json({ success: true, image_url: imageUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
`;
const newContent = content.replace("app.put('/api/seller/settings/:shop_id', async (req, res) => {", newRoute + "app.put('/api/seller/settings/:shop_id', async (req, res) => {");
fs.writeFileSync('c:/smartdeal/smart-deal-backend/src/server.js', newContent);
console.log('Route added!');
