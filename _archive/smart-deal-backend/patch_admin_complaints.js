const fs = require('fs');
const file = 'src/server.js';
let content = fs.readFileSync(file, 'utf8');

const oldAdminComplaints = `app.get('/api/admin/complaints', async (req, res) => {
  try {
    const [complaints] = await db.execute(\`
      SELECT c.*, u.full_name as user_name, u.email, u.phone
      FROM complaints c
      LEFT JOIN users u ON c.user_id = u.user_id
      ORDER BY c.created_at DESC
    \`);
    res.json({ success: true, data: complaints });`;

const newAdminComplaints = `app.get('/api/admin/complaints', async (req, res) => {
  try {
    const [complaints] = await db.execute(\`
      SELECT c.*, 
        DATE_FORMAT(c.created_at, '%Y-%m-%dT%T.000Z') as created_at_str,
        u.full_name as user_name, u.email, u.phone
      FROM complaints c
      LEFT JOIN users u ON c.user_id = u.user_id
      ORDER BY c.created_at DESC
    \`);
    
    // Fix created_at {} bug by using the formatted string
    const formattedComplaints = complaints.map(c => ({
      ...c,
      created_at: c.created_at_str || c.created_at
    }));
    
    res.json({ success: true, data: formattedComplaints });`;

if (content.includes('SELECT c.*, u.full_name as user_name, u.email, u.phone')) {
  // We need to replace it more carefully because whitespace might differ.
  content = content.replace(/SELECT c\.\*, u\.full_name as user_name, u\.email, u\.phone\s+FROM complaints c\s+LEFT JOIN users u ON c\.user_id = u\.user_id\s+ORDER BY c\.created_at DESC/g, 
  `SELECT c.*, DATE_FORMAT(c.created_at, '%Y-%m-%dT%T.000Z') as created_at_str, u.full_name as user_name, u.email, u.phone FROM complaints c LEFT JOIN users u ON c.user_id = u.user_id ORDER BY c.created_at DESC`);
  
  content = content.replace(`res.json({ success: true, data: complaints });`, `const formattedComplaints = complaints.map(c => ({ ...c, created_at: c.created_at_str || c.created_at }));\n    res.json({ success: true, data: formattedComplaints });`);
}

fs.writeFileSync(file, content);
console.log('Fixed admin complaints created_at issue');
