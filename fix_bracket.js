const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'smart-deal-backend/src/server.js');
let code = fs.readFileSync(serverFile, 'utf8');

code = code.replace(
  `    res.json({ success: true, data: formattedOrders, jobs: formattedOrders });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดเซิร์ฟเวอร์' });
  }
});
  }
});`,
  `    res.json({ success: true, data: formattedOrders, jobs: formattedOrders });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดเซิร์ฟเวอร์' });
  }
});`
);

fs.writeFileSync(serverFile, code, 'utf8');
console.log('✅ Removed extra closing brackets');
