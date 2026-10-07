const fs = require('fs');
const file = 'src/server.js';
let content = fs.readFileSync(file, 'utf8');

const route = `
app.get('/api/admin/migrate-shops', async (req, res) => {
  try {
    await db.execute('ALTER TABLE shops ADD COLUMN opening_time TIME DEFAULT "08:00:00", ADD COLUMN closing_time TIME DEFAULT "20:00:00"');
    res.json({ success: true, message: "Migrated successfully!" });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});
`;

if (!content.includes('/api/admin/migrate-shops')) {
  content = content.replace(`app.get('/api/admin/complaints', async (req, res) => {`, route + `\napp.get('/api/admin/complaints', async (req, res) => {`);
}

fs.writeFileSync(file, content);
console.log('Added migrate-shops route');
