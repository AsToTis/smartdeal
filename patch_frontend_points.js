const fs = require('fs');
const path = require('path');

const profilePath = path.join(__dirname, 'smart-deal-app/src/app/(tabs)/profile.tsx');
let content = fs.readFileSync(profilePath, 'utf8');

const targetStr = `  const handleRedeemPoints = async (type: string, cost: number, code: string, title: string, value: number) => {`;
const endIndex = content.indexOf('  const handleLogout = () => {');

if (content.includes(targetStr) && endIndex !== -1) {
  const startIndex = content.indexOf(targetStr);
  const newRedeemCode = `  const handleRedeemPoints = async (type: string, cost: number, code: string, title: string, value: number) => {
    if (points < cost) {
      Alert.alert('แจ้งเตือน', 'คะแนนสะสมของคุณไม่เพียงพอ');
      return;
    }

    Alert.alert('ยืนยันการแลกคะแนน', \`คุณต้องการใช้ \${cost} คะแนน เพื่อแลกรับ \${title} หรือไม่?\`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'แลกของรางวัล',
        onPress: async () => {
          try {
            const userId = user?.user_id || 2;
            const res = await axios.post(\`\${BASE_URL}/points/redeem\`, {
              user_id: userId,
              cost,
              code,
              title,
              type,
              value
            });

            if (res.data && res.data.success) {
              if (res.data.points !== undefined) {
                setPoints(res.data.points);
              } else {
                setPoints(prev => prev - cost);
              }

              // บันทึกคูปองลง AsyncStorage สำรองไว้
              const existingCouponsStr = await AsyncStorage.getItem('savedCoupons');
              let coupons = existingCouponsStr ? JSON.parse(existingCouponsStr) : [];
              const couponObj = res.data.coupon || { code, title, type, value };
              coupons.push({ ...couponObj, expiry: new Date(Date.now() + 86400000 * 7).toISOString() });
              await AsyncStorage.setItem('savedCoupons', JSON.stringify(coupons));

              // โหลดประวัติพอยท์ใหม่
              try {
                const pointsRes = await axios.get(\`\${BASE_URL}/points/\${userId}\`);
                if (pointsRes.data?.success) {
                  setPoints(pointsRes.data.points);
                  setPointsHistory(pointsRes.data.history || []);
                }
              } catch (e) {}

              Alert.alert('สำเร็จ 🎉', \`แลกของรางวัล "\${title}" สำเร็จ!\\nคูปองถูกบันทึกลงระบบของคุณแล้ว สามารถนำไปเลือกใช้เป็นส่วนลดได้ที่หน้าชำระเงิน\`);
            } else {
              Alert.alert('ผิดพลาด', res.data?.message || 'ไม่สามารถแลกของรางวัลได้');
            }
          } catch (e: any) {
            console.error('Redeem error:', e);
            const msg = e.response?.data?.message || 'ไม่สามารถแลกของรางวัลได้';
            Alert.alert('ผิดพลาด', msg);
          }
        }
      }
    ]);
  };

`;

  content = content.slice(0, startIndex) + newRedeemCode + content.slice(endIndex);
  fs.writeFileSync(profilePath, content, 'utf8');
  console.log('✅ Updated profile.tsx handleRedeemPoints successfully');
} else {
  console.log('Target not found, inspecting snippet...');
}
