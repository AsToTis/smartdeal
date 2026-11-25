const fs = require('fs'); 
const file = 'c:/smartdeal/smart-deal-backend/src/server.js'; 
let content = fs.readFileSync(file, 'utf8'); 
content = content.replace(/SELECT a\.\*,\r?\n\s+\(SELECT COUNT\(\*\) FROM auction_bids WHERE auction_id = a\.auction_id\) AS total_bids/g, 'SELECT a.*, CAST(a.end_time AS CHAR) AS end_time_str,\n        (SELECT COUNT(*) FROM auction_bids WHERE auction_id = a.auction_id) AS total_bids'); 

content = content.replace(/const result = auctions.map\(a => \{\r?\n\s+const endTime = new Date\(a.end_time\);\r?\n\s+const diff = endTime - now;/g, 
`const result = auctions.map(a => {
      let endTimeStr = a.end_time_str;
      if (!endTimeStr && a.end_time) { endTimeStr = typeof a.end_time === 'string' ? a.end_time : (JSON.stringify(a.end_time) === '{}' ? '' : a.end_time.toString()); }
      let endTime = endTimeStr ? new Date(endTimeStr.replace(/ /g, 'T')) : new Date(0);
      if (isNaN(endTime.getTime())) endTime = new Date(0);
      const diff = endTime - now;`); 

fs.writeFileSync(file, content);
