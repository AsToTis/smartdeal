const fs = require('fs');
let content = fs.readFileSync('src/server.js', 'utf8');

const initDBCode = `
// === BASE64 IMAGE SUPPORT ===
const initBase64ImageSupport = async () => {
  try {
    console.log('Altering tables for LONGTEXT images...');
    await db.execute('ALTER TABLE products MODIFY image_url LONGTEXT');
    await db.execute('ALTER TABLE shops MODIFY image_url LONGTEXT');
    await db.execute('ALTER TABLE auctions MODIFY image_url LONGTEXT');
    await db.execute('ALTER TABLE users MODIFY avatar_url LONGTEXT');
    await db.execute('ALTER TABLE banners MODIFY image_url LONGTEXT');
    await db.execute('ALTER TABLE complaints MODIFY image_url LONGTEXT');
    console.log('✅ Tables altered for LONGTEXT images successfully.');
  } catch (err) {
    console.error('❌ Error altering tables for LONGTEXT:', err.message);
  }
};
initBase64ImageSupport();
`;

if (!content.includes('initBase64ImageSupport')) {
  content = content.replace('// 0. DATABASE INITIALIZATION', initDBCode + '\n// 0. DATABASE INITIALIZATION');
}

// Now replace image uploading logic to read file as Base64 and store directly
// Instead of modifying every single endpoint, we can intercept multer uploads?
// No, it's safer to just replace `req.file ? \`http://${req.get('host')}/uploads/${req.file.filename}\` :`
// with `req.file ? "data:" + req.file.mimetype + ";base64," + fs.readFileSync(req.file.path).toString("base64") :`
content = content.replace(
  /req\.file \? `http:\/\/\$\{req\.get\('host'\)\}\/uploads\/\$\{req\.file\.filename\}` :/g,
  "req.file ? `data:${req.file.mimetype};base64,${fs.readFileSync(req.file.path).toString('base64')}` :"
);
content = content.replace(
  /req\.file\n\s*\? `http:\/\/\$\{req\.get\('host'\)\}\/uploads\/\$\{req\.file\.filename\}`\n\s*:/g,
  "req.file ? `data:${req.file.mimetype};base64,${fs.readFileSync(req.file.path).toString('base64')}` :"
);
// Also for `/api/shops/:shopId/products`
content = content.replace(
  /req\.file \? \`http\:\/\/\$\{req\.get\('host'\)\}\/uploads\/\$\{req\.file\.filename\}\` \: \(image_url \|\| /g,
  "req.file ? `data:${req.file.mimetype};base64,${fs.readFileSync(req.file.path).toString('base64')}` : (image_url || "
);
// Replace other instances where `req.file.filename` is used
// In `/api/users/:id/avatar`
content = content.replace(
  /const avatarUrl = req\.file \? \`http:\/\/\$\{req\.get\('host'\)\}\/uploads\/\$\{req\.file\.filename\}\` : req\.body\.avatar_url;/g,
  "const avatarUrl = req.file ? `data:${req.file.mimetype};base64,${fs.readFileSync(req.file.path).toString('base64')}` : req.body.avatar_url;"
);
// In seller settings image
content = content.replace(
  /const imageUrl = \`http:\/\/\$\{req\.get\('host'\)\}\/uploads\/\$\{req\.file\.filename\}\`;/g,
  "const imageUrl = `data:${req.file.mimetype};base64,${fs.readFileSync(req.file.path).toString('base64')}`;"
);

// In proof of delivery
content = content.replace(
  /const proofUrl = \`http:\/\/\$\{req\.get\('host'\)\}\/uploads\/\$\{req\.file\.filename\}\`;/g,
  "const proofUrl = `data:${req.file.mimetype};base64,${fs.readFileSync(req.file.path).toString('base64')}`;"
);

fs.writeFileSync('src/server.js', content);
console.log('Patched server.js with DB init and Base64 upload logic');
