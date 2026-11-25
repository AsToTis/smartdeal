const fs = require('fs');

function fixRiderCard() {
  const file = 'src/app/tracking.tsx';
  let content = fs.readFileSync(file, 'utf8');

  // Find the Rider Info Card
  const riderCardRegex = /\{\/\* Rider Info Card \*\/\}\s*<View style=\{styles\.riderCard\}>[\s\S]*?<\/View>\s*<\/View>\s*<\/ScrollView>/;
  
  const replacement = `{/* Rider Info Card */}
          {rider?.name ? (
            <View style={styles.riderCard}>
              <View style={styles.riderHeader}>
                <View style={styles.riderImgWrapper}>
                  <Image source={{ uri: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200' }} style={styles.riderImg} />
                </View>
                <View style={styles.riderInfo}>
                  <Text style={styles.riderName}>
                    {rider?.name}
                  </Text>
                  <Text style={styles.riderPlate}>
                    ทะเบียน {rider?.vehicle_plate}
                  </Text>
                  <Text style={styles.riderVaccine}>ฉีดวัคซีนแล้ว 3 เข็ม</Text>
                </View>
                <View style={styles.riderRating}>
                  <MaterialIcons name="star" size={14} color="#f59e0b" />
                  <Text style={styles.ratingText}>{rider?.rating}</Text>
                </View>
              </View>

              <View style={styles.riderActions}>
                <TouchableOpacity style={styles.actionIconBtn} onPress={handleCall}>
                  <MaterialIcons name="phone" size={20} color="#16a34a" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionIconBtn} onPress={handleChat}>
                  <MaterialCommunityIcons name="chat-processing" size={20} color="#16a34a" />
                </TouchableOpacity>
                
                {statusIdx >= 5 && (
                  <TouchableOpacity style={styles.rateBtn} onPress={() => setShowRatingModal(true)}>
                    <MaterialIcons name="star" size={18} color="#d97706" />
                    <Text style={styles.rateBtnText}>ให้คะแนนคนขับ</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={[styles.riderCard, {alignItems: 'center', paddingVertical: 24}]}>
              <MaterialCommunityIcons name="motorbike" size={48} color="#cbd5e1" />
              <Text style={{marginTop: 8, color: '#64748b', fontSize: 16}}>ระบบกำลังค้นหาคนขับให้คุณ...</Text>
            </View>
          )}
          
        </ScrollView>`;

  if (content.match(riderCardRegex)) {
    content = content.replace(riderCardRegex, replacement);
    fs.writeFileSync(file, content);
    console.log('Fixed rider card');
  } else {
    console.log('Rider card not found with regex');
  }
}

fixRiderCard();
