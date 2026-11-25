const fs = require('fs');

function patchHomeAndSearch() {
  const file = 'src/server.js';
  let content = fs.readFileSync(file, 'utf8');

  // Patch home-data
  const homeDataOld = 'WHERE p.stock_quantity > 0 AND (p.deal_end_time IS NULL OR p.deal_end_time > NOW())';
  const homeDataNew = 'WHERE p.stock_quantity > 0 AND p.is_auction = 0 AND (p.deal_end_time IS NULL OR p.deal_end_time > NOW())';
  if (content.includes(homeDataOld)) {
    content = content.replace(homeDataOld, homeDataNew);
    console.log('Patched home-data to hide auctions');
  }

  // Patch search
  const searchOld = "WHERE p.name LIKE ? AND s.status = 'approved' ORDER BY p.deal_end_time IS NULL ASC, p.deal_end_time ASC`";
  const searchNew = "WHERE p.name LIKE ? AND s.status = 'approved' AND p.is_auction = 0 ORDER BY p.deal_end_time IS NULL ASC, p.deal_end_time ASC`";
  if (content.includes(searchOld)) {
    content = content.replace(searchOld, searchNew);
    console.log('Patched search to hide auctions');
  }

  fs.writeFileSync(file, content);
}

patchHomeAndSearch();
