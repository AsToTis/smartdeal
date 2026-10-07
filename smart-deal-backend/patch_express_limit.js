const fs = require('fs');
let content = fs.readFileSync('src/server.js', 'utf8');

if (content.includes('app.use(express.json());')) {
  content = content.replace(
    'app.use(express.json());',
    `app.use(express.json({ limit: '50mb' }));\napp.use(express.urlencoded({ limit: '50mb', extended: true }));`
  );
  fs.writeFileSync('src/server.js', content);
  console.log('Patched express.json limit');
} else {
  console.log('Could not find express.json()');
}
