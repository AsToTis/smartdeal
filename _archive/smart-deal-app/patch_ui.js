const fs = require('fs');

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Insert isExpiringSoon
  const stateRegex = /const \[isAuction, setIsAuction\] = useState\(false\);/;
  if (content.match(stateRegex) && !content.includes('isExpiringSoon')) {
    const isExpiringSoonCode = `const [isAuction, setIsAuction] = useState(false);

  const isExpiringSoon = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);
    const diffTime = exp.getTime() - today.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays <= 1;
  };`;
    content = content.replace(stateRegex, isExpiringSoonCode);
  }

  // Replace Switch block
  // We need to replace the View wrapper containing notifyTitle and Switch
  const notifyCardRegex = /<View style=\{\[styles\.notifyIconCircle, \{ backgroundColor: '#fef3c7' \}\]\}>[\s\S]*?<Switch[\s\S]*?onValueChange=\{setIsAuction\}[\s\S]*?\/>/;
  
  const newNotifyCard = `<View style={[styles.notifyIconCircle, { backgroundColor: '#fef3c7' }]}>
            <MaterialIcons name="gavel" size={20} color="#d97706" />
          </View>
          <View style={styles.notifyTextWrapper}>
            <Text style={styles.notifyTitle}>ส่งเข้าห้องประมูลด่วน</Text>
            <Text style={styles.notifyDesc}>เปิดให้ลูกค้าเสนอราคาประมูลสินค้า</Text>
            {!isExpiringSoon() && (
              <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                (เฉพาะสินค้าที่จะหมดอายุภายใน 1 วันเท่านั้น)
              </Text>
            )}
          </View>
          <Switch
            trackColor={{ false: '#cbd5e1', true: '#d97706' }}
            thumbColor={'#fff'}
            value={isAuction && isExpiringSoon()}
            onValueChange={setIsAuction}
            disabled={!isExpiringSoon()}
          />`;

  if (content.match(notifyCardRegex)) {
    content = content.replace(notifyCardRegex, newNotifyCard);
    fs.writeFileSync(file, content);
    console.log('Patched ' + file);
  } else {
    console.log('Could not find replace block in ' + file);
  }
}

patchFile('src/app/(seller)/add-product.tsx');
patchFile('src/app/(seller)/edit-product.tsx');
