const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'smart-deal-backend/src/server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// Replace the mock at line 2453:
const mockPointsRegex = /\/\/ 3\. ดึงคะแนนสะสมของผู้ใช้\s*app\.get\('\/api\/points\/:userId', async \(req, res\) => \{[\s\S]*?\}\);\n/m;
if (mockPointsRegex.test(content)) {
  content = content.replace(mockPointsRegex, '// 3. (Points route handled above by dynamic database API)\n');
  console.log('✅ Removed mock points route');
}

fs.writeFileSync(serverPath, content, 'utf8');
console.log('✅ server.js cleaned');
