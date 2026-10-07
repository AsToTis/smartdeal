const fs = require('fs');
let content = fs.readFileSync('src/server.js', 'utf8');

// 1. Update complaints table schema to include order_id
content = content.replace(
  /subject VARCHAR\(255\) NOT NULL,/g,
  "order_id INT NULL,\n        subject VARCHAR(255) NOT NULL,"
);

const alterTableCode = `
    try { await db.execute('ALTER TABLE complaints ADD COLUMN order_id INT NULL AFTER user_id'); } catch (e) {}
`;
content = content.replace(
  /await db\.execute\('ALTER TABLE complaints MODIFY image_url LONGTEXT'\);/g,
  "await db.execute('ALTER TABLE complaints MODIFY image_url LONGTEXT');" + alterTableCode
);

// 2. Add endpoints for complaints
const endpointsCode = `
// ==========================================
// COMPLAINTS (Help Center)
// ==========================================

app.post('/api/complaints', upload.single('image'), async (req, res) => {
  const { user_id, subject, message, order_id } = req.body;
  
  if (!user_id || !subject || !message) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const imageUrl = req.file ? \`data:\${req.file.mimetype};base64,\${fs.readFileSync(req.file.path).toString('base64')}\` : null;

    const [result] = await db.execute(
      \`INSERT INTO complaints (user_id, order_id, subject, message, image_url, status) VALUES (?, ?, ?, ?, ?, 'pending')\`,
      [user_id, order_id || null, subject, message, imageUrl]
    );

    res.status(201).json({ success: true, message: 'Complaint submitted successfully', complaint_id: result.insertId });
  } catch (error) {
    console.error('Error submitting complaint:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/admin/complaints', async (req, res) => {
  try {
    const [complaints] = await db.execute(\`
      SELECT c.*, u.full_name as user_name, u.email, u.phone
      FROM complaints c
      LEFT JOIN users u ON c.user_id = u.user_id
      ORDER BY c.created_at DESC
    \`);
    res.json({ success: true, data: complaints });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.put('/api/admin/complaints/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await db.execute('UPDATE complaints SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    console.error('Error updating complaint status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
`;

if (!content.includes('/api/complaints')) {
  // Add it before "const PORT = process.env.PORT || 5000;" or at the end
  if (content.includes('const PORT = process.env.PORT || 5000;')) {
    content = content.replace('const PORT = process.env.PORT || 5000;', endpointsCode + '\nconst PORT = process.env.PORT || 5000;');
  } else {
    content += '\n' + endpointsCode;
  }
}

fs.writeFileSync('src/server.js', content);
console.log('Patched server.js with complaints endpoints');
