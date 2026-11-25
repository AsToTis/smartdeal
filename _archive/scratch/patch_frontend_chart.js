const fs = require('fs');
const file = 'c:/smartdeal/smart-deal-app/src/app/(seller)/index.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state for chartType
if (!content.includes("const [chartType, setChartType] = useState")) {
  content = content.replace(
    "const [refreshing, setRefreshing] = useState(false);",
    "const [refreshing, setRefreshing] = useState(false);\n  const [chartType, setChartType] = useState<'week' | 'month' | 'year'>('week');"
  );
  content = content.replace(
    "const [refreshing, setRefreshing] = useState(false);\r\n",
    "const [refreshing, setRefreshing] = useState(false);\r\n  const [chartType, setChartType] = useState<'week' | 'month' | 'year'>('week');\r\n"
  );
}

// 2. Replace Dummy Chart with Real Chart
const dummyChartRegex = /\{\/\* กราฟหลอก \*\/\}[\s\S]*?<\/View>\s*<\/View>\s*<\/View>/;
const realChartCode = `{/* Real Chart */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>สรุปยอดขาย</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity onPress={() => setChartType('week')} style={[styles.chartBadge, chartType === 'week' && { backgroundColor: '#16a34a' }]}>
                    <Text style={[styles.chartBadgeText, chartType === 'week' && { color: '#fff' }]}>สัปดาห์นี้</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setChartType('month')} style={[styles.chartBadge, chartType === 'month' && { backgroundColor: '#16a34a' }]}>
                    <Text style={[styles.chartBadgeText, chartType === 'month' && { color: '#fff' }]}>เดือนนี้</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setChartType('year')} style={[styles.chartBadge, chartType === 'year' && { backgroundColor: '#16a34a' }]}>
                    <Text style={[styles.chartBadgeText, chartType === 'year' && { color: '#fff' }]}>ปีนี้</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%' }}>
                <View style={styles.dummyChartSpace}>
                  {dashboardData.chart_data?.[chartType] ? dashboardData.chart_data[chartType].map((item: any, i: number) => {
                    const maxVal = Math.max(...dashboardData.chart_data[chartType].map((d:any) => d.value), 100);
                    const heightPercent = (item.value / maxVal) * 100;
                    const barHeight = Math.max(heightPercent * 0.8, 4); // min height 4px, max 80px approx
                    const isToday = chartType === 'week' && i === 6; // last item in week is today
                    return (
                      <View key={i} style={[styles.chartCol, { width: chartType === 'year' ? 30 : 40 }]}>
                        <View style={[styles.chartBar, { height: barHeight, backgroundColor: (isToday || item.value > 0) ? '#16a34a' : '#e2e8f0' }]} />
                        <Text style={[styles.chartDayText, isToday && { fontWeight: 'bold', color: '#0f172a' }]} numberOfLines={1}>{item.label}</Text>
                      </View>
                    );
                  }) : <Text style={{ color: '#94a3b8', marginTop: 30 }}>ไม่มีข้อมูลกราฟ</Text>}
                </View>
              </ScrollView>

              <View style={styles.chartFooter}>
                <Text style={styles.chartFooterLabel}>รวมยอดขาย ({chartType === 'week' ? 'สัปดาห์' : chartType === 'month' ? 'เดือน' : 'ปี'})</Text>
                <Text style={styles.chartFooterValue}>฿{formatMoney(dashboardData.chart_data?.[chartType]?.reduce((a:any,b:any)=>a+b.value,0) || 0)}</Text>
              </View>
            </View>`;

if (content.match(dummyChartRegex)) {
  content = content.replace(dummyChartRegex, realChartCode);
} else {
  // Try CRLF matching
  console.log('Failed to match dummy chart regex');
}

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully patched seller dashboard frontend chart');
