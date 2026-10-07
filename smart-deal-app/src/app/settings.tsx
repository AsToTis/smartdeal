import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  Switch, Modal, Pressable, TextInput, Alert, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';
import { BASE_URL } from '../constants/api';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300';
const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300'
];

export default function SettingsScreen() {
  const { isDark, toggleTheme, colors } = useTheme();
  
  // App Settings States
  const [pushEnabled, setPushEnabled] = useState(true);
  const [promoEnabled, setPromoEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [language, setLanguage] = useState('ไทย');
  
  // User Data State
  const [user, setUser] = useState<any>(null);

  // Modals
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Edit Profile Form State
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAvatar, setEditAvatar] = useState(DEFAULT_AVATAR);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Change Password Form State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    loadSettings();
    loadUserData();
  }, []);

  const loadSettings = async () => {
    try {
      const storedPrefs = await AsyncStorage.getItem('appSettings');
      if (storedPrefs) {
        const parsed = JSON.parse(storedPrefs);
        setPushEnabled(parsed.pushEnabled ?? true);
        setPromoEnabled(parsed.promoEnabled ?? true);
        setLocationEnabled(parsed.locationEnabled ?? true);
        setLanguage(parsed.language ?? 'ไทย');
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  const loadUserData = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        setUser(parsed);
        setEditName(parsed.full_name || '');
        setEditPhone(parsed.phone || '');
        setEditEmail(parsed.email || '');
        setEditAvatar(parsed.avatar_url || DEFAULT_AVATAR);
      }
    } catch (e) {
      console.error('Failed to load user in settings', e);
    }
  };

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

  const handleToggle = async (key: 'pushEnabled' | 'promoEnabled' | 'locationEnabled' | 'darkMode', val: boolean) => {
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
    }
    saveSettings(key, val);
  };

  const requestLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('การเข้าถึงตำแหน่งที่ตั้ง', 'กรุณาอนุญาตการเข้าถึงตำแหน่งที่ตั้งในการตั้งค่าของอุปกรณ์');
      handleToggle('locationEnabled', false);
    }
  };

  const handleSelectLanguage = (lang: string) => {
    setLanguage(lang);
    saveSettings('language', lang);
    setShowLangModal(false);
    Alert.alert('เปลี่ยนภาษาสำเร็จ', lang === 'ไทย' ? 'เปลี่ยนภาษาเป็น ภาษาไทย เรียบร้อยแล้ว' : 'Language changed to English successfully');
  };

  // Profile Edit Handlers
  const handleOpenProfileModal = () => {
    setEditName(user?.full_name || '');
    setEditPhone(user?.phone || '');
    setEditEmail(user?.email || '');
    setEditAvatar(user?.avatar_url || DEFAULT_AVATAR);
    setShowProfileModal(true);
  };

  const pickAvatar = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setEditAvatar(result.assets[0].uri);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณาระบุชื่อ-นามสกุล');
      return;
    }

    try {
      setIsSavingProfile(true);
      const userId = user?.user_id || 2;
      const res = await axios.put(`${BASE_URL}/users/${userId}/profile`, {
        full_name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        avatar_url: editAvatar
      });

      if (res.data?.success) {
        const updated = {
          ...user,
          full_name: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          avatar_url: editAvatar
        };
        setUser(updated);
        await AsyncStorage.setItem('user', JSON.stringify(updated));
        setShowProfileModal(false);
        Alert.alert('สำเร็จ 🎉', 'บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
      } else {
        Alert.alert('ผิดพลาด', res.data?.message || 'ไม่สามารถบันทึกข้อมูลได้');
      }
    } catch (e: any) {
      console.error('Save profile error:', e);
      Alert.alert('ผิดพลาด', e.response?.data?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Change Password Handlers
  const handleSavePassword = async () => {
    if (!oldPassword) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกรหัสผ่านเดิม');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('แจ้งเตือน', 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('แจ้งเตือน', 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    try {
      setIsChangingPassword(true);
      const userId = user?.user_id || 2;
      const res = await axios.put(`${BASE_URL}/users/${userId}/change-password`, {
        old_password: oldPassword,
        new_password: newPassword
      });

      if (res.data?.success) {
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordModal(false);
        Alert.alert('สำเร็จ 🎉', 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว');
      } else {
        Alert.alert('ผิดพลาด', res.data?.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
      }
    } catch (e: any) {
      console.error('Change password error:', e);
      Alert.alert('ผิดพลาด', e.response?.data?.message || 'รหัสผ่านเดิมไม่ถูกต้อง หรือเกิดข้อผิดพลาด');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Dynamic Theme Colors
  const bgColor = colors.background;
  const cardColor = colors.card;
  const textColor = colors.text;
  const subTextColor = colors.subText;
  const dividerColor = colors.border;
  const iconBg = colors.iconBg;
  const headerBg = colors.card;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: dividerColor }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>ตั้งค่าการใช้งาน</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Account Section */}
        <Text style={[styles.sectionTitle, { color: subTextColor }]}>บัญชีและความปลอดภัย</Text>
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: dividerColor }]}>
          <TouchableOpacity 
            style={styles.row}
            onPress={handleOpenProfileModal}
          >
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="person-outline" size={20} color="#16a34a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowText, { color: textColor }]}>ข้อมูลส่วนตัว</Text>
              <Text style={[styles.subTextRow, { color: subTextColor }]}>{user?.full_name || 'แก้ไขชื่อ เบอร์โทร และโปรไฟล์'}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={subTextColor} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: dividerColor }]} />

          <TouchableOpacity 
            style={styles.row}
            onPress={() => setShowPasswordModal(true)}
          >
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="lock-outline" size={20} color="#eab308" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowText, { color: textColor }]}>เปลี่ยนรหัสผ่าน</Text>
              <Text style={[styles.subTextRow, { color: subTextColor }]}>อัปเดตรหัสผ่านใหม่เพื่อความปลอดภัย</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={subTextColor} />
          </TouchableOpacity>
        </View>

        {/* Notifications Section */}
        <Text style={[styles.sectionTitle, { color: subTextColor }]}>การแจ้งเตือน</Text>
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: dividerColor }]}>
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="notifications-none" size={20} color="#3b82f6" />
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
              <MaterialIcons name="local-offer" size={20} color="#ec4899" />
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
              <Ionicons name="moon-outline" size={20} color="#8b5cf6" />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>โหมดกลางคืน (Dark Mode)</Text>
            <Switch
              value={isDark}
              onValueChange={(val) => handleToggle('darkMode', val)}
              trackColor={{ false: isDark ? '#475569' : '#e2e8f0', true: '#16a34a' }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          <TouchableOpacity style={styles.row} onPress={() => setShowLangModal(true)}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="language" size={20} color="#06b6d4" />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>ภาษา (Language)</Text>
            <Text style={[styles.subText, { color: subTextColor }]}>{language === 'ไทย' ? 'ไทย' : 'English'}</Text>
            <MaterialIcons name="chevron-right" size={22} color={subTextColor} />
          </TouchableOpacity>
        </View>

        {/* Privacy & Legal Section */}
        <Text style={[styles.sectionTitle, { color: subTextColor }]}>ความเป็นส่วนตัวและเงื่อนไข</Text>
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: dividerColor }]}>
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="location-on" size={20} color="#10b981" />
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
          <TouchableOpacity style={styles.row} onPress={() => setShowPrivacyModal(true)}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="policy" size={20} color="#6366f1" />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>นโยบายความเป็นส่วนตัว</Text>
            <MaterialIcons name="chevron-right" size={22} color={subTextColor} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          <TouchableOpacity style={styles.row} onPress={() => setShowTermsModal(true)}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <MaterialIcons name="description" size={20} color="#64748b" />
            </View>
            <Text style={[styles.rowText, { color: textColor }]}>เงื่อนไขการให้บริการ</Text>
            <MaterialIcons name="chevron-right" size={22} color={subTextColor} />
          </TouchableOpacity>
        </View>
        
        <View style={{ height: 50 }} />
      </ScrollView>

      {/* 1. Modal แก้ไขข้อมูลส่วนตัว */}
      <Modal
        visible={showProfileModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalCard, { backgroundColor: cardColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>แก้ไขข้อมูลส่วนตัว 👤</Text>
              <TouchableOpacity onPress={() => setShowProfileModal(false)}>
                <MaterialIcons name="close" size={24} color={subTextColor} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Avatar Selector */}
              <View style={{ alignItems: 'center', marginVertical: 14 }}>
                <Image source={{ uri: editAvatar }} style={styles.avatarPreview} />
                <TouchableOpacity style={styles.pickImgBtn} onPress={pickAvatar}>
                  <MaterialIcons name="photo-camera" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>เลือกรูป</Text>
                </TouchableOpacity>

                {/* Avatar Presets */}
                <Text style={{ fontSize: 11, color: subTextColor, marginTop: 10, marginBottom: 6 }}>หรือเลือกรูปประจำตัว:</Text>
                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                  {AVATAR_PRESETS.map((url, i) => (
                    <TouchableOpacity key={i} onPress={() => setEditAvatar(url)}>
                      <Image 
                        source={{ uri: url }} 
                        style={[
                          styles.presetAvatar, 
                          editAvatar === url && { borderColor: '#16a34a', borderWidth: 2.5 }
                        ]} 
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Input Fields */}
              <Text style={[styles.inputLabel, { color: textColor }]}>ชื่อ-นามสกุล</Text>
              <TextInput
                style={[styles.input, { backgroundColor: iconBg, color: textColor, borderColor: dividerColor }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="ระบุชื่อ-นามสกุล"
                placeholderTextColor={subTextColor}
              />

              <Text style={[styles.inputLabel, { color: textColor }]}>เบอร์โทรศัพท์</Text>
              <TextInput
                style={[styles.input, { backgroundColor: iconBg, color: textColor, borderColor: dividerColor }]}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="ระบุเบอร์โทรศัพท์"
                placeholderTextColor={subTextColor}
                keyboardType="phone-pad"
              />

              <Text style={[styles.inputLabel, { color: textColor }]}>อีเมล</Text>
              <TextInput
                style={[styles.input, { backgroundColor: iconBg, color: textColor, borderColor: dividerColor }]}
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="ระบุอีเมล"
                placeholderTextColor={subTextColor}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </ScrollView>

            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={handleSaveProfile}
              disabled={isSavingProfile}
            >
              {isSavingProfile ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>บันทึกข้อมูลส่วนตัว</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 2. Modal เปลี่ยนรหัสผ่าน */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalCard, { backgroundColor: cardColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>เปลี่ยนรหัสผ่าน 🔒</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <MaterialIcons name="close" size={24} color={subTextColor} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: textColor }]}>รหัสผ่านเดิม</Text>
              <View style={[styles.passwordInputWrapper, { backgroundColor: iconBg, borderColor: dividerColor }]}>
                <TextInput
                  style={[styles.passwordInput, { color: textColor }]}
                  secureTextEntry={!showOldPassword}
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  placeholder="กรอกรหัสผ่านปัจจุบัน"
                  placeholderTextColor={subTextColor}
                />
                <TouchableOpacity onPress={() => setShowOldPassword(!showOldPassword)}>
                  <MaterialIcons name={showOldPassword ? "visibility" : "visibility-off"} size={20} color={subTextColor} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputLabel, { color: textColor }]}>รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</Text>
              <View style={[styles.passwordInputWrapper, { backgroundColor: iconBg, borderColor: dividerColor }]}>
                <TextInput
                  style={[styles.passwordInput, { color: textColor }]}
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="กรอกรหัสผ่านใหม่"
                  placeholderTextColor={subTextColor}
                />
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                  <MaterialIcons name={showNewPassword ? "visibility" : "visibility-off"} size={20} color={subTextColor} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputLabel, { color: textColor }]}>ยืนยันรหัสผ่านใหม่</Text>
              <View style={[styles.passwordInputWrapper, { backgroundColor: iconBg, borderColor: dividerColor }]}>
                <TextInput
                  style={[styles.passwordInput, { color: textColor }]}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  placeholderTextColor={subTextColor}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <MaterialIcons name={showConfirmPassword ? "visibility" : "visibility-off"} size={20} color={subTextColor} />
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={handleSavePassword}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>บันทึกรหัสผ่านใหม่</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 3. Modal เลือกภาษา */}
      <Modal
        visible={showLangModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLangModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLangModal(false)}>
          <View style={[styles.modalCard, { backgroundColor: cardColor, width: '85%' }]}>
            <Text style={[styles.modalTitle, { color: textColor, marginBottom: 14 }]}>เลือกภาษา (Select Language)</Text>
            
            <TouchableOpacity 
              style={[styles.langOption, language === 'ไทย' && styles.langOptionActive]}
              onPress={() => handleSelectLanguage('ไทย')}
            >
              <Text style={[styles.langText, { color: textColor }]}>🇹🇭 ภาษาไทย (Thai)</Text>
              {language === 'ไทย' && <MaterialIcons name="check-circle" size={22} color="#16a34a" />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.langOption, language === 'English' && styles.langOptionActive]}
              onPress={() => handleSelectLanguage('English')}
            >
              <Text style={[styles.langText, { color: textColor }]}>🇬🇧 English (US)</Text>
              {language === 'English' && <MaterialIcons name="check-circle" size={22} color="#16a34a" />}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* 4. Modal นโยบายความเป็นส่วนตัว (Privacy Policy) */}
      <Modal
        visible={showPrivacyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPrivacyModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: cardColor, maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>นโยบายความเป็นส่วนตัว (PDPA) 🛡️</Text>
              <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
                <MaterialIcons name="close" size={24} color={subTextColor} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 10 }}>
              <Text style={[styles.policyHeading, { color: textColor }]}>1. การเก็บรวบรวมข้อมูลส่วนบุคคล</Text>
              <Text style={[styles.policyText, { color: subTextColor }]}>
                แอปพลิเคชัน Smart Deal เก็บรวบรวมข้อมูลส่วนบุคคลของท่าน เช่น ชื่อ นามสกุล เบอร์โทรศัพท์ อีเมล พิกัดตำแหน่งที่ตั้ง (GPS) และประวัติการสั่งซื้อ เพื่อใช้ในการให้บริการจัดส่งอาหาร การคำนวณระยะทาง และการรักษาความปลอดภัยของระบบ
              </Text>

              <Text style={[styles.policyHeading, { color: textColor }]}>2. วัตถุประสงค์ในการประมวลผลข้อมูล</Text>
              <Text style={[styles.policyText, { color: subTextColor }]}>
                - เพื่อเชื่อมต่อระหว่างผู้ซื้อ ร้านค้า และไรเดอร์ในการจัดส่งอาหาร{"\n"}
                - เพื่อจัดส่งการแจ้งเตือนสถานะออเดอร์และสิทธิประโยชน์แต้มสะสม{"\n"}
                - เพื่อตรวจสอบความถูกต้องในการชำระเงินและการขอคืนเงิน
              </Text>

              <Text style={[styles.policyHeading, { color: textColor }]}>3. การรักษาความปลอดภัยของข้อมูล</Text>
              <Text style={[styles.policyText, { color: subTextColor }]}>
                ข้อมูลของท่านได้รับการปกป้องด้วยมาตรฐานความปลอดภัยระดับสูง ข้อมูลรหัสผ่านถูกเข้ารหัสผ่านทางเดียว (Bcrypt Hash) และการรับส่งข้อมูลผ่านเครือข่ายได้รับการเข้ารหัสด้วย SSL/TLS 256-bit Encryption
              </Text>

              <Text style={[styles.policyHeading, { color: textColor }]}>4. สิทธิของเจ้าของข้อมูลส่วนบุคคล</Text>
              <Text style={[styles.policyText, { color: subTextColor }]}>
                ท่านมีสิทธิในการเข้าถึง แก้ไข ลบ หรือระงับการใช้ข้อมูลส่วนบุคคลของท่านได้ตลอดเวลาผ่านทางเมนูการตั้งค่า หรือติดต่อฝ่ายดูแลลูกค้า Smart Deal
              </Text>
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={() => setShowPrivacyModal(false)}>
              <Text style={styles.saveBtnText}>เข้าใจและยอมรับ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 5. Modal เงื่อนไขการให้บริการ (Terms of Service) */}
      <Modal
        visible={showTermsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: cardColor, maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>เงื่อนไขการให้บริการ 📜</Text>
              <TouchableOpacity onPress={() => setShowTermsModal(false)}>
                <MaterialIcons name="close" size={24} color={subTextColor} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 10 }}>
              <Text style={[styles.policyHeading, { color: textColor }]}>1. แพลตฟอร์มลดขยะอาหาร (Smart Deal)</Text>
              <Text style={[styles.policyText, { color: subTextColor }]}>
                Smart Deal เป็นแพลตฟอร์มที่เชื่อมโยงร้านค้าที่มีอาหารส่วนเกินคุณภาพดี หรือดีลอาหารลดราคาพิเศษ กับผู้บริโภค เพื่อส่งเสริมการบริโภคอย่างคุ้มค่าและลดผลกระทบต่อสิ่งแวดล้อม
              </Text>

              <Text style={[styles.policyHeading, { color: textColor }]}>2. มาตรฐานความสดใหม่และสุขอนามัย</Text>
              <Text style={[styles.policyText, { color: subTextColor }]}>
                ร้านค้าทุกร้านได้รับการตรวจสอบและมีหน้าที่รับผิดชอบในการจัดเตรียมอาหารที่สะอาด ถูกสุขอนามัย และปลอดภัยตามมาตรฐานอาหาร
              </Text>

              <Text style={[styles.policyHeading, { color: textColor }]}>3. การสั่งซื้อ การชำระเงิน และการยกเลิก</Text>
              <Text style={[styles.policyText, { color: subTextColor }]}>
                - เมื่อผู้ซื้อกดยืนยันการชำระเงิน ระบบจะส่งออเดอร์ให้ร้านค้าเตรียมอาหารทันที{"\n"}
                - ผู้ซื้อสามารถตรวจสอบสถานะการจัดส่งแบบเรียลไทม์ได้ในหน้ารายละเอียดออเดอร์{"\n"}
                - หากพบปัญหาเกี่ยวกับรายการอาหาร สามารถติดต่อร้านค้าหรือฝ่ายบริการลูกค้าผ่านศูนย์ช่วยเหลือได้ทันที
              </Text>

              <Text style={[styles.policyHeading, { color: textColor }]}>4. การเปลี่ยนแปลงเงื่อนไข</Text>
              <Text style={[styles.policyText, { color: subTextColor }]}>
                แพลตฟอร์มขอสงวนสิทธิ์ในการปรับปรุงหรือแก้ไขเงื่อนไขการให้บริการตามความเหมาะสมเพื่อประโยชน์สูงสุดของผู้ใช้งานทุกคน
              </Text>
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={() => setShowTermsModal(false)}>
              <Text style={styles.saveBtnText}>ตกลง</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowText: {
    fontSize: 15,
    fontWeight: '600',
  },
  subTextRow: {
    fontSize: 12,
    marginTop: 2,
  },
  subText: {
    fontSize: 14,
    marginRight: 8,
  },
  divider: {
    height: 1,
    marginLeft: 64,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  langOptionActive: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  langText: {
    fontSize: 15,
    fontWeight: '600',
  },
  avatarPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
  },
  pickImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  presetAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  policyHeading: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  policyText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
});
