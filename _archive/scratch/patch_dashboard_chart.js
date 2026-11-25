const fs = require('fs');
const file = 'c:/smartdeal/smart-deal-backend/src/server.js';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `    res.json({
      success: true,
      shop: shop,
      stats: stats,
      recentOrders: formattedOrders
    });`;

const newStr = `
    // 4. Get Chart Data (Week, Month, Year)
    const [chartDataRows] = await db.execute(\`
      SELECT 
        DATE(o.created_at) as date_val,
        MONTH(o.created_at) as month_val,
        YEAR(o.created_at) as year_val,
        SUM(oi.price * oi.quantity) AS daily_gross
      FROM orders o
      JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.product_id
      WHERE (oi.shop_id = ? OR p.shop_id = ?)
        AND o.order_status IN ('completed', 'paid', 'delivered', 'shipped')
        AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
      GROUP BY DATE(o.created_at), MONTH(o.created_at), YEAR(o.created_at)
    \`, [shop_id, shop_id]);

    const chart_data = { week: [], month: [], year: [] };
    
    // Process Week (last 7 days)
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabels = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
      const row = chartDataRows.find(r => {
        const rDate = new Date(r.date_val);
        // Correct for timezone offset if necessary, but simple string matching is safer if date_val is YYYY-MM-DD
        const rDateStr = [rDate.getFullYear(), String(rDate.getMonth() + 1).padStart(2, '0'), String(rDate.getDate()).padStart(2, '0')].join('-');
        return rDateStr === dateStr;
      });
      chart_data.week.push({
        label: dayLabels[d.getDay()],
        value: row ? parseFloat(row.daily_gross) * fee_multiplier : 0
      });
    }

    // Process Month (current month, group by week or day? Usually day or chunks. Let's do 4 weeks)
    // For simplicity, let's just do weeks of the current month
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    let week1=0, week2=0, week3=0, week4=0;
    chartDataRows.forEach(r => {
      if (r.month_val === currentMonth && r.year_val === currentYear) {
        const d = new Date(r.date_val).getDate();
        const val = parseFloat(r.daily_gross) * fee_multiplier;
        if (d <= 7) week1 += val;
        else if (d <= 14) week2 += val;
        else if (d <= 21) week3 += val;
        else week4 += val;
      }
    });
    chart_data.month = [
      { label: 'สัปดาห์ 1', value: week1 },
      { label: 'สัปดาห์ 2', value: week2 },
      { label: 'สัปดาห์ 3', value: week3 },
      { label: 'สัปดาห์ 4', value: week4 }
    ];

    // Process Year (all 12 months)
    const monthLabels = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    for (let m = 1; m <= 12; m++) {
      const row = chartDataRows.filter(r => r.month_val === m && r.year_val === currentYear);
      const sum = row.reduce((acc, curr) => acc + (parseFloat(curr.daily_gross) * fee_multiplier), 0);
      chart_data.year.push({
        label: monthLabels[m - 1],
        value: sum
      });
    }

    res.json({
      success: true,
      shop: shop,
      stats: stats,
      recentOrders: formattedOrders,
      chart_data: chart_data
    });`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, newStr);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully patched seller dashboard API for chart data');
} else {
  // Try CRLF
  const targetStrCRLF = targetStr.replace(/\n/g, '\r\n');
  if (content.includes(targetStrCRLF)) {
    content = content.replace(targetStrCRLF, newStr.replace(/\n/g, '\r\n'));
    fs.writeFileSync(file, content, 'utf8');
    console.log('Successfully patched seller dashboard API for chart data (CRLF)');
  } else {
    console.log('Failed to find exact res.json block');
  }
}
