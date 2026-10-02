const fs = require('fs');

function patchServerJS() {
  const file = 'src/server.js';
  let content = fs.readFileSync(file, 'utf8');

  // Replace for create product
  const createRegex = /discount_price \|\| original_price \|\| 0,\s*discount_price \|\| original_price \|\| 0,/g;
  const newCreateStr = `Math.floor((discount_price || original_price || 0) * 0.3),
          Math.floor((discount_price || original_price || 0) * 0.3),`;
  
  if (content.match(createRegex)) {
    content = content.replace(createRegex, newCreateStr);
    console.log('Patched create product auction price');
  }

  // Replace for edit product
  const editRegex = /product\.discount_price \|\| product\.original_price \|\| 0, product\.discount_price \|\| product\.original_price \|\| 0,/g;
  const newEditStr = `Math.floor((product.discount_price || product.original_price || 0) * 0.3), Math.floor((product.discount_price || product.original_price || 0) * 0.3),`;
  
  if (content.match(editRegex)) {
    content = content.replace(editRegex, newEditStr);
    console.log('Patched edit product auction price');
  }

  fs.writeFileSync(file, content);
}

patchServerJS();
