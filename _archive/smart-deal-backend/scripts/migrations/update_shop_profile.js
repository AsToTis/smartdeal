const fs = require('fs');

let code = fs.readFileSync('c:/smartdeal/smart-deal-app/src/app/shop-profile.tsx', 'utf8');

// UI fix for avatar clipping
// I will add zIndex: 10 and elevation: 5 to infoCard and avatar
code = code.replace(
  /infoCard:\s*\{[\s\S]*?marginTop: -40,[\s\S]*?shadowRadius: 12,\s*\}/m,
  (match) => match.replace('marginTop: -40,', 'marginTop: -40,\n    zIndex: 10,')
);

code = code.replace(
  /avatar:\s*\{[\s\S]*?marginBottom: 12,\s*\}/m,
  (match) => match.replace('marginTop: -40,', 'marginTop: -40,\n    zIndex: 10,\n    elevation: 5,')
);


// Replace Mock Data
const dataTarget = `<Image 
            source={{ uri: shop?.image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300' }} 
            style={styles.avatar} 
          />
          <Text style={styles.shopName}>{shop?.name || 'ชื่อร้านค้า'}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialIcons name="star" size={16} color="#fbbf24" />
              <Text style={styles.statText}>{shop?.rating || '4.8'}</Text>
            </View>
            <Text style={styles.statDot}>•</Text>
            <View style={styles.statItem}>
              <MaterialIcons name="location-on" size={16} color="#94a3b8" />
              <Text style={styles.statText}>{shop?.distance || '1.2 km'}</Text>
            </View>
            <Text style={styles.statDot}>•</Text>
            <Text style={styles.statText}>เปิด 08:00 - 20:00</Text>
          </View>
          <Text style={styles.addressText} numberOfLines={2}>
            {shop?.address || '123 ถนนสุขุมวิท เขตวัฒนา กรุงเทพฯ'}
          </Text>`;

const dataReplace = `<Image 
            source={{ uri: shop?.image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300' }} 
            style={styles.avatar} 
          />
          <Text style={styles.shopName}>{shop?.name || 'ไม่มีชื่อร้าน'}</Text>
          <View style={styles.statsRow}>
            {shop?.rating ? (
              <>
                <View style={styles.statItem}>
                  <MaterialIcons name="star" size={16} color="#fbbf24" />
                  <Text style={styles.statText}>{shop.rating}</Text>
                </View>
                <Text style={styles.statDot}>•</Text>
              </>
            ) : null}
            
            {shop?.distance ? (
              <>
                <View style={styles.statItem}>
                  <MaterialIcons name="location-on" size={16} color="#94a3b8" />
                  <Text style={styles.statText}>{shop.distance}</Text>
                </View>
                <Text style={styles.statDot}>•</Text>
              </>
            ) : null}
            
            <Text style={styles.statText}>{shop?.opening_hours ? \`เปิด \${shop.opening_hours}\` : 'ไม่ได้ระบุเวลา'}</Text>
          </View>
          <Text style={styles.addressText} numberOfLines={2}>
            {shop?.address || 'ไม่ได้ระบุที่อยู่'}
          </Text>`;

code = code.replace(dataTarget, dataReplace);

fs.writeFileSync('c:/smartdeal/smart-deal-app/src/app/shop-profile.tsx', code);
console.log('done updating shop-profile.tsx');
