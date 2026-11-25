const fs = require('fs');
let code = fs.readFileSync('c:/smartdeal/smart-deal-app/src/app/(seller)/settings.tsx', 'utf8');

// 1. Add mapRegion state
if (!code.includes('mapRegion')) {
  code = code.replace(
    'const [userId, setUserId] = useState<string | null>(null);',
    `const [userId, setUserId] = useState<string | null>(null);\n  const [mapRegion, setMapRegion] = useState({ latitude: 13.7563, longitude: 100.5018, latitudeDelta: 0.01, longitudeDelta: 0.01 });\n  const [tempLocation, setTempLocation] = useState({ latitude: 13.7563, longitude: 100.5018 });`
  );
}

// 2. Initialize mapRegion when opening edit modal for address
const openEditTarget = `const openEdit = (field: string, title: string) => {`;
const openEditReplacement = `const openEdit = (field: string, title: string) => {
    if (field === 'address') {
      const lat = parseFloat(formData.latitude) || 13.7563;
      const lng = parseFloat(formData.longitude) || 100.5018;
      setMapRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      setTempLocation({ latitude: lat, longitude: lng });
    }`;
code = code.replace(openEditTarget, openEditReplacement);

// 3. Save location when handling edit save
const handleEditSaveTarget = `setFormData((prev: any) => ({ ...prev, [editModal.field]: editModal.value }));`;
const handleEditSaveReplacement = `if (editModal.field === 'address') {
      setFormData((prev: any) => ({ ...prev, address: editModal.value, latitude: tempLocation.latitude, longitude: tempLocation.longitude }));
    } else {
      setFormData((prev: any) => ({ ...prev, [editModal.field]: editModal.value }));
    }`;
code = code.replace(handleEditSaveTarget, handleEditSaveReplacement);

// 4. Render MapView in the modal
const modalContentTarget = `<TextInput
              style={styles.textInput}
              value={editModal.value}
              onChangeText={(text) => setEditModal(prev => ({...prev, value: text}))}
              autoFocus
              multiline={editModal.field === 'address'}
            />`;

const modalContentReplacement = `<TextInput
              style={styles.textInput}
              value={editModal.value}
              onChangeText={(text) => setEditModal(prev => ({...prev, value: text}))}
              autoFocus={editModal.field !== 'address'}
              multiline={editModal.field === 'address'}
            />
            {editModal.field === 'address' && (
              <View style={{ height: 200, width: '100%', marginTop: 10, borderRadius: 12, overflow: 'hidden' }}>
                <MapView
                  style={{ flex: 1 }}
                  region={mapRegion}
                  onRegionChangeComplete={(region) => {
                    setMapRegion(region);
                    setTempLocation({ latitude: region.latitude, longitude: region.longitude });
                  }}
                >
                  <Marker coordinate={tempLocation} />
                </MapView>
                <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(255,255,255,0.8)', padding: 4, borderRadius: 4 }}>
                  <Text style={{ fontSize: 10 }}>เลื่อนแผนที่เพื่อปักหมุด</Text>
                </View>
              </View>
            )}`;
code = code.replace(modalContentTarget, modalContentReplacement);

fs.writeFileSync('c:/smartdeal/smart-deal-app/src/app/(seller)/settings.tsx', code);
console.log('Successfully added MapView to settings modal.');
