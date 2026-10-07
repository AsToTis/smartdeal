const fs = require('fs');
const file = 'src/app/(seller)/settings.tsx';
let content = fs.readFileSync(file, 'utf8');

const badTimePicker = /\{showTimePicker && \(\s*<DateTimePicker[\s\S]*?\/>\s*\)\}/g;
const goodTimePicker = `
      {showTimePicker && Platform.OS === 'android' && (
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
            if (event.type === 'set' && selectedDate) {
              const h = selectedDate.getHours().toString().padStart(2, '0');
              const m = selectedDate.getMinutes().toString().padStart(2, '0');
              setFormData(prev => ({ ...prev, [timeMode === 'opening' ? 'opening_time' : 'closing_time']: \`\${h}:\${m}:00\` }));
            }
          }}
        />
      )}

      {showTimePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <View style={{flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.5)'}}>
            <View style={{backgroundColor:'white', padding: 20, paddingBottom: 40}}>
              <View style={{flexDirection:'row', justifyContent:'flex-end', marginBottom: 10}}>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={{color:'#16a34a', fontWeight:'bold', fontSize: 18}}>เสร็จสิ้น</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={(() => {
                  const timeStr = timeMode === 'opening' ? (formData.opening_time || '08:00') : (formData.closing_time || '20:00');
                  const d = new Date();
                  d.setHours(parseInt(timeStr.split(':')[0]));
                  d.setMinutes(parseInt(timeStr.split(':')[1] || '0'));
                  return d;
                })()}
                mode="time"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    const h = selectedDate.getHours().toString().padStart(2, '0');
                    const m = selectedDate.getMinutes().toString().padStart(2, '0');
                    setFormData(prev => ({ ...prev, [timeMode === 'opening' ? 'opening_time' : 'closing_time']: \`\${h}:\${m}:00\` }));
                  }
                }}
              />
            </View>
          </View>
        </Modal>
      )}
`;

content = content.replace(badTimePicker, goodTimePicker);
fs.writeFileSync(file, content);
console.log('Fixed TimePicker UI for iOS');
