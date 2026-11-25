const fs = require('fs');
let code = fs.readFileSync('c:/smartdeal/smart-deal-backend/src/server.js', 'utf8');
const cron = fs.readFileSync('c:/smartdeal/scratch/cron_job.js', 'utf8');
code = code.replace("app.listen(PORT, '0.0.0.0', () => {", cron + "\n\napp.listen(PORT, '0.0.0.0', () => {");
fs.writeFileSync('c:/smartdeal/smart-deal-backend/src/server.js', code);
console.log('Injected cron job');
