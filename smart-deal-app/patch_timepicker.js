const fs = require('fs');
const file = 'src/app/(seller)/settings.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import
if (!content.includes('DateTimePicker')) {
  content = content.replace("import MapView, { Marker } from 'react-native-maps';", "import MapView, { Marker } from 'react-native-maps';\nimport DateTimePicker from '@react-native-community/datetimepicker';");
}

// Add state for Time Picker
if (!content.includes('showTimePicker')) {
  content = content.replace('const [tempLocation, setTempLocation] = useState', `const [showTimePicker, setShowTimePicker] = useState(false);\n  const [timeMode, setTimeMode] = useState<'opening' | 'closing'>('opening');\n  const [tempLocation, setTempLocation] = useState`);
}

// Modify the opening_hours item in UI
const oldOpeningHours = `<TouchableOpacity style={styles.settingItem} activeOpacity={0.7} onPress={() => openEdit('opening_hours', 'เวลาเปิด-ปิด')}>
            <View style={[styles.iconCircle, { backgroundColor: '#f1f5f9' }]}>
              <MaterialIcons name="access-time" size={20} color="#2e7a32" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>เวลาเปิด-ปิด</Text>
              <Text style={styles.settingValue}>{formData.opening_hours || 'ทุกวัน 08:00 - 20:00'}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#cbd5e1" />
          </TouchableOpacity>`;

const newOpeningHours = `<View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.iconCircle, { backgroundColor: '#f1f5f9', marginRight: 15 }]}>
                <MaterialIcons name="access-time" size={20} color="#2e7a32" />
              </View>
              <View>
                <Text style={styles.settingLabel}>เวลาเปิด</Text>
                <TouchableOpacity onPress={() => { setTimeMode('opening'); setShowTimePicker(true); }}>
                  <Text style={[styles.settingValue, { color: '#3b82f6', fontWeight: 'bold' }]}>{formData.opening_time ? formData.opening_time.substring(0,5) : '08:00'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View>
                <Text style={styles.settingLabel}>เวลาปิด</Text>
                <TouchableOpacity onPress={() => { setTimeMode('closing'); setShowTimePicker(true); }}>
                  <Text style={[styles.settingValue, { color: '#ef4444', fontWeight: 'bold' }]}>{formData.closing_time ? formData.closing_time.substring(0,5) : '20:00'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>`;

content = content.replace(oldOpeningHours, newOpeningHours);

// Add TimePicker Component
const timePickerComponent = `
      {showTimePicker && (
        <DateTimePicker
          value={(() => {
            const timeStr = timeMode === 'opening' ? (formData.opening_time || '08:00') : (formData.closing_time || '20:00');
            const d = new Date();
            d.setHours(parseInt(timeStr.split(':')[0]));
            d.setMinutes(parseInt(timeStr.split(':')[1] || '0'));
            return d;
          })()}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={(event, selectedDate) => {
            setShowTimePicker(false);
            if (selectedDate) {
              const h = selectedDate.getHours().toString().padStart(2, '0');
              const m = selectedDate.getMinutes().toString().padStart(2, '0');
              const timeString = \`\${h}:\${m}:00\`;
              setFormData(prev => ({ ...prev, [timeMode === 'opening' ? 'opening_time' : 'closing_time']: timeString }));
            }
          }}
        />
      )}
`;

if (!content.includes('DateTimePicker')) {
  content = content.replace('</SafeAreaView>', timePickerComponent + '\n    </SafeAreaView>');
} else {
  // If we already inserted the import but the component itself is not there
  if (!content.includes('mode="time"')) {
    content = content.replace('</SafeAreaView>', timePickerComponent + '\n    </SafeAreaView>');
  }
}

fs.writeFileSync(file, content);
console.log('Time picker added to settings.tsx');
