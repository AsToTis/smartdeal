const fs = require('fs');
const file = 'c:/smartdeal/smart-deal-app/src/app/(seller)/index.tsx';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split(/\r?\n/);

const startIdx = lines.findIndex(l => l.includes('{/* กราฟหลอก */}'));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('{/* เมนูลัด */}'));

if (startIdx !== -1 && endIdx !== -1) {
  const realChartCode = `            {/* Real Chart */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>สรุปยอดขาย</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity onPress={() => setChartType('week')} style={[styles.chartBadge, chartType === 'week' && { backgroundColor: '#16a34a' }]}>
                    <Text style={[styles.chartBadgeText, chartType === 'week' && { color: '#fff' }]}>สัปดาห์</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setChartType('month')} style={[styles.chartBadge, chartType === 'month' && { backgroundColor: '#16a34a' }]}>
                    <Text style={[styles.chartBadgeText, chartType === 'month' && { color: '#fff' }]}>เดือน</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setChartType('year')} style={[styles.chartBadge, chartType === 'year' && { backgroundColor: '#16a34a' }]}>
                    <Text style={[styles.chartBadgeText, chartType === 'year' && { color: '#fff' }]}>ปี</Text>
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
                      <View key={i} style={[styles.chartCol, { width: chartType === 'year' ? 30 : 40, marginRight: 8 }]}>
                        <View style={[styles.chartBar, { height: barHeight, backgroundColor: (isToday || item.value > 0) ? '#16a34a' : '#e2e8f0' }]} />
                        <Text style={[styles.chartDayText, isToday && { fontWeight: 'bold', color: '#0f172a' }]} numberOfLines={1}>{item.label}</Text>
                      </View>
                    );
                  }) : <Text style={{ color: '#94a3b8', marginTop: 30, textAlign: 'center', width: '100%' }}>ไม่มีข้อมูลกราฟ</Text>}
                </View>
              </ScrollView>

              <View style={styles.chartFooter}>
                <Text style={styles.chartFooterLabel}>รวมยอดขาย ({chartType === 'week' ? 'สัปดาห์' : chartType === 'month' ? 'เดือน' : 'ปี'})</Text>
                <Text style={styles.chartFooterValue}>฿{formatMoney(dashboardData.chart_data?.[chartType]?.reduce((a:any,b:any)=>a+b.value,0) || 0)}</Text>
              </View>
            </View>
`;

  lines.splice(startIdx, endIdx - startIdx, realChartCode);
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log('Successfully patched seller dashboard frontend chart using array splice');
} else {
  console.log('Failed to find start or end index for dummy chart');
}
