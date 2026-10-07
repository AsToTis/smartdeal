const fs = require('fs');
const file = 'src/app/(seller)/settings.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add import for Location
if (!content.includes('import * as Location')) {
  content = content.replace("import MapView, { Marker } from 'react-native-maps';", "import MapView, { Marker } from 'react-native-maps';\nimport * as Location from 'expo-location';");
}

// 2. Add getCurrentLocation function inside component
const funcInjection = `
  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('แจ้งเตือน', 'กรุณาอนุญาตการเข้าถึงตำแหน่งที่ตั้ง (GPS)');
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      const region = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005
      };
      setMapRegion(region);
      setTempLocation({ latitude: region.latitude, longitude: region.longitude });
    } catch(err) {
      console.log(err);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถดึงตำแหน่งปัจจุบันได้');
    }
  };
`;
if (!content.includes('getCurrentLocation')) {
  content = content.replace('const pickImage = async () => {', funcInjection + '\n  const pickImage = async () => {');
}

// 3. Add GPS button in MapView
const gpsButton = `
                <TouchableOpacity 
                  style={{ position: 'absolute', bottom: 20, right: 10, backgroundColor: '#fff', padding: 10, borderRadius: 25, elevation: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2 }}
                  onPress={getCurrentLocation}
                >
                  <MaterialIcons name="my-location" size={24} color="#3b82f6" />
                </TouchableOpacity>
`;
content = content.replace('<Marker coordinate={tempLocation} />\n                </MapView>', '<Marker coordinate={tempLocation} />\n                </MapView>' + gpsButton);

fs.writeFileSync(file, content);
console.log('GPS functionality added to settings.tsx');
