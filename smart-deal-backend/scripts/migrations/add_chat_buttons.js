const fs = require('fs');

let code = fs.readFileSync('c:/smartdeal/smart-deal-app/src/app/(tabs)/orders.tsx', 'utf8');

const modalActionRow = `              {/* Row 1: ติดตามสถานะ / รีวิว + สั่งซ้ำ */}`;
const chatBtn = `{/* ปุ่มแชท (Order Chat System) */}
              {['preparing', 'shipped', 'completed'].includes(selectedOrder?.order_status) && (
                <View style={{ marginBottom: 8 }}>
                  <TouchableOpacity 
                    style={[styles.trackNavBtn, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}
                    onPress={() => {
                      const id = selectedOrder?.order_id;
                      setSelectedOrder(null);
                      router.push({ pathname: '/order-chat' as any, params: { order_id: id, role: 'buyer', user_id: 2 } });
                    }}
                  >
                    <Ionicons name="chatbubble-ellipses" size={16} color="#0f172a" />
                    <Text style={[styles.trackNavBtnText, { color: '#0f172a', marginLeft: 6 }]}>แชทกับร้านค้า</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Row 1: ติดตามสถานะ / รีวิว + สั่งซ้ำ */}`;

if (!code.includes('แชทกับร้านค้า')) {
  code = code.replace(modalActionRow, chatBtn);
  fs.writeFileSync('c:/smartdeal/smart-deal-app/src/app/(tabs)/orders.tsx', code);
  console.log('done (tabs)/orders.tsx');
} else {
  console.log('already added in (tabs)/orders.tsx');
}

// Seller orders.tsx
let sellerCode = fs.readFileSync('c:/smartdeal/smart-deal-app/src/app/(seller)/orders.tsx', 'utf8');
const sellerActionRow = `                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.detailBtn}>`;
const sellerChatBtn = `                  <View style={styles.actionRow}>
                    {['preparing', 'shipped', 'completed'].includes(item.order_status) && (
                      <TouchableOpacity 
                        style={[styles.detailBtn, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', marginRight: 8 }]}
                        onPress={() => router.push({ pathname: '/order-chat' as any, params: { order_id: item.order_id, role: 'seller', user_id: 1 } })}
                      >
                        <MaterialIcons name="chat" size={14} color="#0f172a" />
                        <Text style={[styles.detailBtnText, { color: '#0f172a', marginLeft: 4 }]}>แชท</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.detailBtn}>`;

if (!sellerCode.includes('แชท</Text>')) {
  sellerCode = sellerCode.replace(sellerActionRow, sellerChatBtn);
  fs.writeFileSync('c:/smartdeal/smart-deal-app/src/app/(seller)/orders.tsx', sellerCode);
  console.log('done (seller)/orders.tsx');
} else {
  console.log('already added in (seller)/orders.tsx');
}
