const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const adminBannerApis = `
// ==========================================
// ADMIN BANNER APIs
// ==========================================
app.get('/api/admin/banners', async (req, res) => {
  try {
    const [banners] = await db.query('SELECT * FROM banners ORDER BY created_at DESC');
    res.json({ success: true, data: banners || [] });
  } catch (error) {
    console.error(error);
    // As requested, return empty array on error instead of 500
    res.json({ success: false, data: [] });
  }
});

app.post('/api/admin/banners', async (req, res) => {
  const { image_url, link_url, title, subtitle, badge_text, is_active } = req.body;
  if (!image_url) {
    return res.status(400).json({ success: false, message: 'image_url is required' });
  }
  
  try {
    const [result] = await db.query(
      'INSERT INTO banners (image_url, link_url, title, subtitle, badge_text, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [image_url, link_url || null, title || null, subtitle || null, badge_text || null, is_active !== undefined ? is_active : true]
    );
    res.json({ success: true, message: 'Banner created', id: result.insertId });
  } catch (error) {
    console.error('Error creating banner:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

app.put('/api/admin/banners/:id', async (req, res) => {
  const id = req.params.id;
  const { image_url, link_url, title, subtitle, badge_text, is_active } = req.body;
  
  try {
    await db.query(
      'UPDATE banners SET image_url = COALESCE(?, image_url), link_url = ?, title = ?, subtitle = ?, badge_text = ?, is_active = COALESCE(?, is_active) WHERE id = ?',
      [image_url, link_url, title, subtitle, badge_text, is_active, id]
    );
    res.json({ success: true, message: 'Banner updated' });
  } catch (error) {
    console.error('Error updating banner:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

app.delete('/api/admin/banners/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await db.query('DELETE FROM banners WHERE id = ?', [id]);
    res.json({ success: true, message: 'Banner deleted' });
  } catch (error) {
    console.error('Error deleting banner:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});
`;

if (!code.includes('/api/admin/banners')) {
  code = code.replace("app.listen(PORT,", adminBannerApis + "\napp.listen(PORT,");
  fs.writeFileSync('server.js', code);
  console.log('Admin Banners API inserted');
} else {
  console.log('Already exists');
}
