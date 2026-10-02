const fs = require('fs');

function patchServerJS30Mins() {
  const file = 'src/server.js';
  let content = fs.readFileSync(file, 'utf8');

  // Replace end_time logic in create and edit
  const timeRegex = /product\.deal_end_time \|\| new Date\(Date\.now\(\) \+ 24\*60\*60\*1000\)\.toISOString\(\)\.slice\(0, 19\)\.replace\('T', ' '\)/g;
  const newTimeStr = "new Date(Date.now() + 30*60*1000).toISOString().slice(0, 19).replace('T', ' ')";
  
  if (content.match(timeRegex)) {
    content = content.replace(timeRegex, newTimeStr);
    console.log('Patched auction end time to 30 mins');
  }

  fs.writeFileSync(file, content);
}

patchServerJS30Mins();
