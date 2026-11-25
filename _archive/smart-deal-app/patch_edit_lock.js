const fs = require('fs');

function patchEditProductUI() {
  const file = 'src/app/(seller)/edit-product.tsx';
  let content = fs.readFileSync(file, 'utf8');

  // Add initialIsAuction state
  if (!content.includes('initialIsAuction')) {
    content = content.replace(
      /const \[isAuction, setIsAuction\] = useState\(false\);/,
      `const [isAuction, setIsAuction] = useState(false);
  const [initialIsAuction, setInitialIsAuction] = useState(false);`
    );

    content = content.replace(
      /setIsAuction\(p\.is_auction === 1\);/,
      `setIsAuction(p.is_auction === 1);
            setInitialIsAuction(p.is_auction === 1);`
    );
  }

  // Disable save button and inputs if initialIsAuction is true
  if (content.includes('handleSave')) {
    const handleSaveStr = 'const handleSave = async () => {';
    const newHandleSaveStr = `const handleSave = async () => {
    if (initialIsAuction) {
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถแก้ไขสินค้าได้ในขณะที่กำลังอยู่ในห้องประมูล');
      return;
    }`;
    if (!content.includes('ไม่สามารถแก้ไขสินค้าได้ในขณะที่กำลังอยู่ในห้องประมูล')) {
        content = content.replace(handleSaveStr, newHandleSaveStr);
    }
  }

  // Update touchable opacity disabled
  const saveBtnRegex = /<TouchableOpacity style=\{styles\.saveBtn\} onPress=\{handleSave\}>/;
  const newSaveBtn = `<TouchableOpacity style={[styles.saveBtn, initialIsAuction && { backgroundColor: '#94a3b8' }]} onPress={handleSave} disabled={initialIsAuction}>`;
  if (content.match(saveBtnRegex) && !content.includes('initialIsAuction && { backgroundColor:')) {
    content = content.replace(saveBtnRegex, newSaveBtn);
  }
  
  // Show message at top if locked
  const headerRegex = /<ScrollView style=\{styles\.container\}>/;
  const newHeader = `<ScrollView style={styles.container}>
        {initialIsAuction && (
          <View style={{ backgroundColor: '#fee2e2', padding: 12, margin: 16, borderRadius: 8, marginBottom: 0 }}>
            <Text style={{ color: '#ef4444', fontSize: 14, textAlign: 'center', fontFamily: 'Kanit-Medium' }}>
              สินค้านี้กำลังอยู่ในห้องประมูล ไม่สามารถแก้ไขข้อมูลได้
            </Text>
          </View>
        )}`;
  if (content.match(headerRegex) && !content.includes('สินค้านี้กำลังอยู่ในห้องประมูล')) {
    content = content.replace(headerRegex, newHeader);
  }

  fs.writeFileSync(file, content);
  console.log('Patched edit-product UI');
}

patchEditProductUI();
