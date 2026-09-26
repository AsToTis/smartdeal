import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Switch, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Alert, Linking, ActionSheetIOS, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';
import { BASE_URL } from '../constants/api';

export default function SettingsScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [promoEnabled, setPromoEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const { isDark, toggleTheme, colors } = useTheme();
  const [language, setLanguage] = useState('ไทย');
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);

  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedPrefs = await AsyncStorage.getItem('appSettings');
        if (storedPrefs) {
          const parsed = JSON.parse(storedPrefs);
          setPushEnabled(parsed.pushEnabled ?? true);
          setPromoEnabled(parsed.promoEnabled ?? true);
          setLocationEnabled(parsed.locationEnabled ?? true);
          setLanguage(parsed.language ?? 'ไทย');
          setTwoFAEnabled(parsed.twoFAEnabled ?? false);
        }
      } catch (e) {
        console.error('Failed to load settings', e);
      }
    };
    loadSettings();
  }, []);

  const saveSettings = async (key: string, value: any) => {
    try {
      const storedPrefs = await AsyncStorage.getItem('appSettings');
      let parsed = storedPrefs ? JSON.parse(storedPrefs) : {};
      parsed[key] = value;
      await AsyncStorage.setItem('appSettings', JSON.stringify(parsed));
    } catch (e) {
      console.error('Failed to save setting', e);
    }
  };

  const handleToggle = async (key: 'pushEnabled' | 'promoEnabled' | 'locationEnabled' | 'darkMode' | 'twoFAEnabled', val: boolean) => {
    switch(key) {
      case 'pushEnabled': setPushEnabled(val); break;
      case 'promoEnabled': setPromoEnabled(val); break;
      case 'locationEnabled': 
        if (val) requestLocation();
        setLocationEnabled(val); 
        break;
      case 'darkMode': 
        toggleTheme(); 
        break;
      case 'twoFAEnabled': 
        setTwoFAEnabled(val);
        try {
          const userStr = await AsyncStorage.getItem('user');
          if (userStr) {
            const user = JSON.parse(userStr);
            await axios.put(`${BASE_URL}/users/${user.user_id}/2fa`, { is_2fa_enabled: val });
            user.is_2fa_enabled = val;
            await AsyncStorage.setItem('user', JSON.stringify(user));
          }
        } catch (e) {
          console.error('Error updating 2FA:', e);
          Alert.alert('ผิดพลาด', 'ไม่สามารถบันทึกการตั้งค่า 2FA ได้');
        }
        break;
    }
    saveSettings(key, val);
  };

  const requestLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission to access location was denied', 'กรุณาอนุญาตการเข้าถึงตำแหน่งที่ตั้งในตั้งค่าเครื่องของคุณ');
      handleToggle('locationEnabled', false);
    }
  };

  const handleChangeLanguage = () => {
    setShowLangModal(true);
  };

  const handleSelectLanguage = (lang: string) => {
    setLanguage(lang);
    saveSettings('language', lang);
    setShowLangModal(false);
  };

  // Dynamic Theme Colors (pull from ThemeContext)
  const bgColor = colors.background;
  const cardColor = colors.card;
  const textColor = colors.text;
  const subTextColor = colors.subText;
  const dividerColor = colors.border;
  const iconBg = colors.iconBg;
  const headerBg = colors.card;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: dividerColor }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>ตั้งค่าการใช้งาน</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Account Section */}
        <Text style={[styles.sectionTitle, { color: subTextColor }]}>บัญชีและความปลอดภัย</Text>
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: dividerColor }]}>
          <TouchableOpacity 
            style={styles.row}
            onPress={() => {
              Alert.alert('ข้อมูลส่วนตัว', 'กรุณากลับไปที่หน้าโปรไฟล์ เพื่อกดแก้ไขข้อมูลส่วนตัวของคุณ');
            }}
          >
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="person-outline" size={20} color={subTextColor} />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>ข้อมูลส่วนตัว</Text>
            <MaterialIcons name="chevron-right" size={22} color={subTextColor} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          <TouchableOpacity 
            style={styles.row}
            onPress={() => {
              Alert.alert('เปลี่ยนรหัสผ่าน', 'กรุณากลับไปที่หน้าโปรไฟล์ เพื่อเปลี่ยนรหัสผ่านของคุณ');
            }}
          >
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="lock-outline" size={20} color={subTextColor} />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>เปลี่ยนรหัสผ่าน</Text>
            <MaterialIcons name="chevron-right" size={22} color={subTextColor} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="security" size={20} color={subTextColor} />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>การยืนยันตัวตนแบบ 2 ขั้นตอน (2FA)</Text>
            <Switch
              value={twoFAEnabled}
              onValueChange={(val) => handleToggle('twoFAEnabled', val)}
              trackColor={{ false: isDark ? '#475569' : '#e2e8f0', true: '#16a34a' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Notifications Section */}
        <Text style={[styles.sectionTitle, { color: subTextColor }]}>การแจ้งเตือน</Text>
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: dividerColor }]}>
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="notifications-none" size={20} color={subTextColor} />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>แจ้งเตือนอัปเดตคำสั่งซื้อ</Text>
            <Switch
              value={pushEnabled}
              onValueChange={(val) => handleToggle('pushEnabled', val)}
              trackColor={{ false: isDark ? '#475569' : '#e2e8f0', true: '#16a34a' }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="local-offer" size={20} color={subTextColor} />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>โปรโมชั่นและดีลพิเศษ</Text>
            <Switch
              value={promoEnabled}
              onValueChange={(val) => handleToggle('promoEnabled', val)}
              trackColor={{ false: isDark ? '#475569' : '#e2e8f0', true: '#16a34a' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Preferences Section */}
        <Text style={[styles.sectionTitle, { color: subTextColor }]}>การแสดงผลและภาษา</Text>
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: dividerColor }]}>
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <Ionicons name="moon-outline" size={20} color={subTextColor} />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>โหมดกลางคืน (Dark Mode)</Text>
            <Switch
              value={isDark}
              onValueChange={(val) => handleToggle('darkMode', val)}
              trackColor={{ false: '#475569', true: '#16a34a' }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          <TouchableOpacity style={styles.row} onPress={handleChangeLanguage}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="language" size={20} color={subTextColor} />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>ภาษา (Language)</Text>
            <Text style={[styles.subText, { color: subTextColor }]}>{language}</Text>
            <MaterialIcons name="chevron-right" size={22} color={subTextColor} />
          </TouchableOpacity>
        </View>

        {/* Privacy Section */}
        <Text style={[styles.sectionTitle, { color: subTextColor }]}>ความเป็นส่วนตัว</Text>
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: dividerColor }]}>
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="location-on" size={20} color={subTextColor} />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>การเข้าถึงตำแหน่งที่ตั้ง (GPS)</Text>
            <Switch
              value={locationEnabled}
              onValueChange={(val) => handleToggle('locationEnabled', val)}
              trackColor={{ false: isDark ? '#475569' : '#e2e8f0', true: '#16a34a' }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          <TouchableOpacity style={styles.row} onPress={() => Alert.alert('นโยบายความเป็นส่วนตัว', 'นโยบายความเป็นส่วนตัวของเราครอบคลุมการเก็บรวบรวม และปกป้องข้อมูลของคุณให้ปลอดภัยและเป็นไปตามหลัก PDPA\n\n© 2026 Smart Deal App')}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="policy" size={20} color={subTextColor} />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>นโยบายความเป็นส่วนตัว</Text>
            <MaterialIcons name="chevron-right" size={22} color={subTextColor} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          <TouchableOpacity style={styles.row} onPress={() => Alert.alert('เงื่อนไขการให้บริการ', 'กรุณาปฏิบัติตามกฎระเบียบของแพลตฟอร์มอย่างเคร่งครัด ทั้งเรื่องการชำระเงินและการยกเลิกออเดอร์')}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="description" size={20} color={subTextColor} />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>เงื่อนไขการให้บริการ</Text>
            <MaterialIcons name="chevron-right" size={22} color={subTextColor} />
          </TouchableOpacity>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Language Modal */}
      <Modal
        visible={showLangModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLangModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLangModal(false)}>
          <View style={[styles.modalCard, { backgroundColor: cardColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>เลือกภาษา (Select Language)</Text>
            <TouchableOpacity 
              style={[styles.langOption, language === 'ไทย' && styles.langOptionActive]}
              onPress={() => handleSelectLanguage('ไทย')}
            >
              <Text style={[styles.langText, { color: textColor }]}>🇹🇭 ภาษาไทย</Text>
              {language === 'ไทย' && <MaterialIcons name="check-circle" size={20} color="#16a34a" />}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.langOption, language === 'English' && styles.langOptionActive]}
              onPress={() => handleSelectLanguage('English')}
            >
              <Text style={[styles.langText, { color: textColor }]}>🇬🇧 English</Text>
              {language === 'English' && <MaterialIcons name="check-circle" size={20} color="#16a34a" />}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 12,
    marginLeft: 4,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
  },
  subText: {
    fontSize: 14,
    color: '#94a3b8',
    marginRight: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 64,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  modalCard: {
    borderRadius: 20,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center'
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.03)'
  },
  langOptionActive: {
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    borderWidth: 1,
    borderColor: '#16a34a'
  },
  langText: {
    fontSize: 16,
    fontWeight: '500'
  }
});
