const fs = require('fs');
const file = 'src/server.js';
let content = fs.readFileSync(file, 'utf8');

const startupMigration = `// Database Connection
const db = mysql.createPool(dbConfig);

// Auto-migrate shops table
db.execute('ALTER TABLE shops ADD COLUMN opening_time TIME DEFAULT "08:00:00", ADD COLUMN closing_time TIME DEFAULT "20:00:00"').catch(e => console.log('Shops table already migrated.'));
`;
content = content.replace(`// Database Connection
const db = mysql.createPool(dbConfig);`, startupMigration);

fs.writeFileSync(file, content);
console.log('Added startup migration for shops table');
