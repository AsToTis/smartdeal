const fs = require('fs');
const file = 'c:/smartdeal/smart-deal-app/src/app/(tabs)/index.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `                    <Text style={[styles.shopName, isMyShop && { color: '#0284c7' }]} numberOfLines={1}>
                      🏬 {item.shop_name || 'ร้านค้าพรีเมียม'} {isMyShop ? '(ร้านของคุณ)' : ''}
                    </Text>`;

const replaceStr = `                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 2 }}>
                      <Text style={[styles.shopName, { marginTop: 0, marginBottom: 0, flex: 1 }, isMyShop && { color: '#0284c7' }]} numberOfLines={1}>
                        🏬 {item.shop_name || 'ร้านค้าพรีเมียม'} {isMyShop ? '(ร้านของคุณ)' : ''}
                      </Text>
                      {item.shop_rating !== undefined && item.shop_rating > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4 }}>
                          <Ionicons name="star" size={12} color="#f59e0b" />
                          <Text style={{ fontSize: 11, color: '#666', marginLeft: 2, fontWeight: 'bold' }}>
                            {Number(item.shop_rating).toFixed(1)}
                          </Text>
                        </View>
                      )}
                    </View>`;

if (content.includes("🏬 {item.shop_name || 'ร้านค้าพรีเมียม'} {isMyShop ? '(ร้านของคุณ)' : ''}")) {
  content = content.replace(targetStr, replaceStr);
  content = content.replace(targetStr.replace(/\n/g, '\r\n'), replaceStr.replace(/\n/g, '\r\n'));
}

fs.writeFileSync(file, content, 'utf8');
console.log('Patched index.tsx for shop rating');
