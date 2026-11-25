const fs = require('fs');
let content = fs.readFileSync('C:/smartdealadmin/src/components/Sidebar.jsx', 'utf8');
const navItemsStr = `  const navItems = [
    { name: 'ภาพรวม', path: '/', icon: LayoutDashboard },
    { name: 'จัดการผู้ใช้', path: '/users', icon: Users },
    { name: 'จัดการร้านค้า', path: '/shops', icon: Store },
    { name: 'อนุมัติร้านใหม่', path: '/approvals', icon: StoreIcon },
    { name: 'คำขอถอนเงิน', path: '/withdrawals', icon: Wallet },
    { name: 'เรื่องร้องเรียน', path: '/tickets', icon: MessageSquareWarning },
    { name: 'ตั้งค่าระบบ', path: '/settings', icon: Settings },
  ];`;
content = content.replace(/const navItems = \[[\s\S]*?\];/, navItemsStr);
fs.writeFileSync('C:/smartdealadmin/src/components/Sidebar.jsx', content, 'utf8');
console.log('Fixed Sidebar.jsx');
