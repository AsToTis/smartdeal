const fs = require('fs');
const file = 'src/server.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Update /api/home-data SQL
const oldHomeSql = `      WHERE p.stock_quantity > 0 AND p.is_auction = 0 AND (p.deal_end_time IS NULL OR p.deal_end_time > NOW()) 
      ORDER BY p.deal_end_time IS NULL ASC, p.deal_end_time ASC`;
const newHomeSql = `      WHERE p.stock_quantity > 0 AND p.is_auction = 0 
      ORDER BY p.deal_end_time IS NULL ASC, p.deal_end_time ASC`;

content = content.replace(oldHomeSql, newHomeSql);

// 2. Update /api/home-data Mapping
const oldHomeMap = `    const deals = products.filter(isOpen).map(p => {
      const rawExpires = p.deal_end_time || p.expires_at || p.end_time || p.pickup_end_time;
      const formattedExpiresAt = rawExpires ? new Date(rawExpires).toISOString() : null;`;

const newHomeMap = `    const deals = products.filter(isOpen).map(p => {
      let formattedExpiresAt = null;
      if (p.closing_time) {
        const todayTh = new Date(new Date().getTime() + 7 * 3600 * 1000);
        const yyyy = todayTh.getUTCFullYear();
        const mm = String(todayTh.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(todayTh.getUTCDate()).padStart(2, '0');
        formattedExpiresAt = \`\${yyyy}-\${mm}-\${dd}T\${p.closing_time}\`;
      } else {
        const rawExpires = p.deal_end_time || p.expires_at || p.end_time || p.pickup_end_time;
        formattedExpiresAt = rawExpires ? new Date(rawExpires).toISOString() : null;
      }
`;
content = content.replace(oldHomeMap, newHomeMap);

// 3. Update /api/products SQL
const oldProdSql = `      WHERE p.stock_quantity > 0 AND (p.deal_end_time IS NULL OR p.deal_end_time > NOW())`;
const newProdSql = `      WHERE p.stock_quantity > 0`;

content = content.replace(oldProdSql, newProdSql);

// 4. Update /api/products Mapping
const oldProdMap = `    const formattedProducts = rows.filter(isOpen).map(p => {
      const rawExpires = p.deal_end_time || p.expires_at || p.end_time || p.pickup_end_time;
      const formattedExpiresAt = rawExpires ? new Date(rawExpires).toISOString() : null;`;

const newProdMap = `    const formattedProducts = rows.filter(isOpen).map(p => {
      let formattedExpiresAt = null;
      if (p.closing_time) {
        const todayTh = new Date(new Date().getTime() + 7 * 3600 * 1000);
        const yyyy = todayTh.getUTCFullYear();
        const mm = String(todayTh.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(todayTh.getUTCDate()).padStart(2, '0');
        formattedExpiresAt = \`\${yyyy}-\${mm}-\${dd}T\${p.closing_time}\`;
      } else {
        const rawExpires = p.deal_end_time || p.expires_at || p.end_time || p.pickup_end_time;
        formattedExpiresAt = rawExpires ? new Date(rawExpires).toISOString() : null;
      }
`;
content = content.replace(oldProdMap, newProdMap);

fs.writeFileSync(file, content);
console.log("Patched server.js successfully");
