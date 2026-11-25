const fs = require('fs');

function patchSellerHandOver() {
  const ordersFile = 'src/app/(seller)/orders.tsx';
  let ordersContent = fs.readFileSync(ordersFile, 'utf8');

  // Patch "ส่งมอบแล้ว" button in orders.tsx
  const oldOrdersBtn = /{activeTab === 'ready' && \(\s*<TouchableOpacity\s*style=\{styles\.primaryBtn\}\s*onPress=\{\(\) => handleUpdateStatus\(order\.order_id, 'delivering'\)\}\s*>\s*<Text style=\{styles\.primaryBtnText\}>ส่งมอบแล้ว<\/Text>\s*<\/TouchableOpacity>\s*\)}/g;

  const newOrdersBtn = `{activeTab === 'ready' && (
                      <TouchableOpacity 
                        style={[styles.primaryBtn, !order.rider_name && { backgroundColor: '#94a3b8' }]}
                        onPress={() => {
                          if (!order.rider_name) {
                            Alert.alert('รอดำเนินการ', 'ยังไม่มีคนขับรับงานนี้ กรุณารอคนขับรับงานก่อนกดส่งมอบ');
                            return;
                          }
                          handleUpdateStatus(order.order_id, 'delivering');
                        }}
                      >
                        <Text style={styles.primaryBtnText}>ส่งมอบแล้ว</Text>
                      </TouchableOpacity>
                    )}`;

  if (ordersContent.match(oldOrdersBtn)) {
    ordersContent = ordersContent.replace(oldOrdersBtn, newOrdersBtn);
    fs.writeFileSync(ordersFile, ordersContent);
    console.log('Patched orders.tsx');
  }

  const detailsFile = 'src/app/(seller)/order-details.tsx';
  let detailsContent = fs.readFileSync(detailsFile, 'utf8');

  // Patch "ส่งมอบให้ไรเดอร์แล้ว" button in order-details.tsx
  const oldDetailsBtn = /{order\.order_status === 'ready' && \(\s*<TouchableOpacity\s*style=\{styles\.actionBtn\}\s*onPress=\{\(\) => handleUpdateStatus\('shipped'\)\}\s*>\s*<Text style=\{styles\.actionBtnText\}>ส่งมอบให้ไรเดอร์แล้ว<\/Text>\s*<\/TouchableOpacity>\s*\)}/g;

  const newDetailsBtn = `{order.order_status === 'ready' && (
          <TouchableOpacity 
            style={[styles.actionBtn, !order.rider_name && { backgroundColor: '#94a3b8' }]}
            onPress={() => {
              if (!order.rider_name) {
                Alert.alert('รอดำเนินการ', 'ยังไม่มีคนขับรับงานนี้ กรุณารอคนขับรับงานก่อนกดส่งมอบ');
                return;
              }
              handleUpdateStatus('shipped');
            }}
          >
            <Text style={styles.actionBtnText}>ส่งมอบให้ไรเดอร์แล้ว</Text>
          </TouchableOpacity>
        )}`;

  if (detailsContent.match(oldDetailsBtn)) {
    detailsContent = detailsContent.replace(oldDetailsBtn, newDetailsBtn);
    fs.writeFileSync(detailsFile, detailsContent);
    console.log('Patched order-details.tsx');
  }
}

patchSellerHandOver();
