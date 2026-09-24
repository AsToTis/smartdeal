const { execSync } = require('child_process');
const out = execSync('wmic process where "CommandLine like \\'%node server.js%\\'" get ProcessId').toString();
const pids = out.split('\\n').filter(l => !l.includes('ProcessId') && l.trim().length > 0).map(l => l.trim());
console.log('PIDs:', pids);
pids.forEach(pid => {
  console.log('Killing PID:', pid);
  execSync('taskkill /PID ' + pid + ' /F');
});
