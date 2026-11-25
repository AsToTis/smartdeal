const fs = require('fs');
const path = require('path');

function analyzeBackend() {
    const serverPath = 'c:/smartdeal/smart-deal-backend/src/server.js';
    const content = fs.readFileSync(serverPath, 'utf8');
    
    // Find all APIs
    const routes = [];
    const regex = /app\.(get|post|put|delete)\(['"](\/api\/[^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        // Find the block of code for this route to extract SQL and params
        const method = match[1].toUpperCase();
        const apiPath = match[2];
        const startIndex = match.index;
        
        let block = content.substring(startIndex, startIndex + 3000); // just grab next 3000 chars roughly
        
        // Find SQL queries
        const sqls = [];
        const sqlRegex = /SELECT[\s\S]*?FROM[^\n"']+|INSERT INTO[^\n"']+|UPDATE[^\n"']+SET[^\n"']+|DELETE FROM[^\n"']+/gi;
        let sqlMatch;
        while ((sqlMatch = sqlRegex.exec(block)) !== null) {
            if (!sqls.includes(sqlMatch[0].substring(0, 100))) {
                sqls.push(sqlMatch[0].substring(0, 150).replace(/\s+/g, ' '));
            }
        }
        
        // Check for req.body, req.params, req.query
        const params = [];
        if (block.includes('req.body')) params.push('body');
        if (block.includes('req.params')) params.push('params');
        if (block.includes('req.query')) params.push('query');
        
        routes.push({ method, path: apiPath, params, sqls: sqls.slice(0, 3) }); // Keep top 3 SQLs
    }
    
    fs.writeFileSync('c:/smartdeal/scratch/backend_analysis.json', JSON.stringify(routes, null, 2));
    console.log(`Backend analysis complete: ${routes.length} routes found.`);
}

function analyzeFrontend() {
    const dir = 'c:/smartdeal/smart-deal-app/src/app';
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
    const analysis = {};
    
    for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        const stateCount = (content.match(/useState/g) || []).length;
        const effectCount = (content.match(/useEffect/g) || []).length;
        const apiCalls = (content.match(/fetch\(['"`](.*?)['"`]|axios\.(get|post|put|delete)\(['"`](.*?)['"`]/g) || []).map(s => s.substring(0, 50));
        analysis[file] = { stateCount, effectCount, apiCalls: [...new Set(apiCalls)] };
    }
    
    fs.writeFileSync('c:/smartdeal/scratch/frontend_analysis.json', JSON.stringify(analysis, null, 2));
    console.log(`Frontend analysis complete: ${files.length} files analyzed.`);
}

function findAdminFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== '.expo' && file !== 'dist') {
                results = results.concat(findAdminFiles(filePath));
            }
        } else {
            if (file.toLowerCase().includes('admin') || filePath.toLowerCase().includes('admin')) {
                results.push(filePath);
            }
        }
    });
    return results;
}

analyzeBackend();
analyzeFrontend();
const adminFiles = findAdminFiles('c:/smartdeal');
fs.writeFileSync('c:/smartdeal/scratch/admin_files.json', JSON.stringify(adminFiles, null, 2));
console.log(`Admin files found: ${adminFiles.length}`);
