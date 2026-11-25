const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, 'smart-deal-app/src/app/settings.tsx');
let content = fs.readFileSync(settingsPath, 'utf8');

// Fix broken {'\n'} strings
content = content.replace(/\{'\r?\n'\}/g, '{"\\n"}');
content = content.replace(/\{'\\n'\}/g, '{"\\n"}');

// Also clean up any broken quotes
content = content.replace(/\{'\n'/g, '{"\\n"');
content = content.replace(/\{'\r\n'/g, '{"\\n"');

fs.writeFileSync(settingsPath, content, 'utf8');
console.log('✅ Cleaned syntax in settings.tsx');
