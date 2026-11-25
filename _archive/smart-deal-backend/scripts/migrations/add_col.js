const db = require('../../src/db');
db.execute("ALTER TABLE shops ADD COLUMN opening_hours VARCHAR(100) DEFAULT 'ทุกวัน 08:00 - 20:00';").then(() => {
  console.log('Added opening_hours column');
  process.exit(0);
}).catch(e => {
  if (e.code === 'ER_DUP_FIELDNAME') {
    console.log('Column already exists');
    process.exit(0);
  }
  console.error(e);
  process.exit(1);
});
