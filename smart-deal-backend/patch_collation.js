const fs = require('fs');

function fixCollation() {
  const file = 'src/server.js';
  let content = fs.readFileSync(file, 'utf8');

  // Regex to find the bad query and add COLLATE
  const badSQL = /WHERE title = oi\.product_name LIMIT 1/g;
  
  if (content.match(badSQL)) {
    content = content.replace(badSQL, "WHERE title COLLATE utf8mb4_unicode_ci = oi.product_name COLLATE utf8mb4_unicode_ci LIMIT 1");
    fs.writeFileSync(file, content);
    console.log('Fixed collation error in SQL');
  } else {
    console.log('Did not find bad SQL');
  }
}

fixCollation();
