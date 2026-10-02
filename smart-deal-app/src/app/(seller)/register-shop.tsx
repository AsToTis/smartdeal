import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { BASE_URL } from '../../constants/api';

export default function RegisterShopScreen() {
  const [step, setStep] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Step 1: Owner Info & Bank
  const [idCardImage, setIdCardImage] = useState<string | null>(null);
  const [bankName, setBankName] = useState('KBANK');
  const [bankAccount, setBankAccount] = useState('');
  const [bookbankImage, setBookbankImage] = useState<string | null>(null);
  const [showBankDropdown, setShowBankDropdown] = useState(false);

  // Step 2: Shop Info & Map
  const [shopName, setShopName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(1); // Default
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState(13.725109);
  const [longitude, setLongitude] = useState(100.569109);
  const [categories, setCategories] = useState<any[]>([]);

  // State for pending check
  const [isPending, setIsPending] = useState(false);

  const bankList = ['KBANK', 'SCB', 'BBL', 'KTB', 'BAY', 'TTB'];

  useEffect(() => {
    checkPendingStatus();
    fetchCategories();
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('การอนุญาตถูกปฏิเสธ', 'กรุณาอนุญาตการเข้าถึงตำแหน่งเพื่อปักหมุดร้านค้า');
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);
    } catch (error) {
      console.log('Error getting location', error);
    }
  };

  const checkPendingStatus = async () => {
    try {
      let userId = 999; // Mock user ID that definitely has no shop
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const u = JSON.parse(userData);
        if (u.user_id) userId = u.user_id;
      }
      
      const res = await axios.get(`${BASE_URL}/users/${userId}/shop`);
      if (res.data?.success && res.data.hasShop) {
        const status = res.data.shop.status;
        if (status === 'pending') {
          setIsPending(true);
          setStep(3);
        } else if (status === 'approved') {
          Alert.alert('แจ้งเตือน', `คุณมีร้านค้าที่อนุมัติแล้วในระบบ`, [
            { text: 'กลับ', onPress: () => router.back() }
          ]);
        } else if (status === 'rejected') {
          setIsRejected(true);
          setRejectReason(res.data.shop.reject_reason || 'ไม่ระบุเหตุผล');
          
          setShopName(res.data.shop.name || '');
          setDescription(res.data.shop.description || '');
          if (res.data.shop.category_id) setCategoryId(res.data.shop.category_id);
          setAddress(res.data.shop.address || '');
          if (res.data.shop.latitude) setLatitude(parseFloat(res.data.shop.latitude));
          if (res.data.shop.longitude) setLongitude(parseFloat(res.data.shop.longitude));
          if (res.data.shop.bank_name) setBankName(res.data.shop.bank_name);
          setBankAccount(res.data.shop.bank_account || '');
          
          const getImageUrl = (path: string) => {
            if (!path) return null;
            if (path.startsWith('http')) return path;
            if (path.startsWith('file://')) return null; // Force re-upload if DB has broken local path
            return `${BASE_URL.replace('/api', '')}${path}`;
          };
          
          const idUrl = getImageUrl(res.data.shop.id_card_image);
          if (idUrl) setIdCardImage(idUrl);
          
          const bbUrl = getImageUrl(res.data.shop.bookbank_image);
          if (bbUrl) setBookbankImage(bbUrl);
          
          setStep(0); // special step for rejection screen
        }
      }
    } catch (e) {
      console.log('Check shop error:', e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/home-data`);
      if (res.data?.success && res.data.categories) {
        setCategories(res.data.categories);
      }
    } catch (e) {}
  };

  const pickImage = async (setImage: (uri: string) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const validateStep1 = () => {
    if (!idCardImage) return Alert.alert('ข้อผิดพลาด', 'กรุณาอัปโหลดรูปถ่ายบัตรประชาชน');
    if (!bankAccount) return Alert.alert('ข้อผิดพลาด', 'กรุณากรอกเลขที่บัญชีธนาคาร');
    if (!bookbankImage) return Alert.alert('ข้อผิดพลาด', 'กรุณาอัปโหลดรูปหน้าสมุดบัญชี');
    setStep(2);
  };

  const validateStep2 = () => {
    if (!shopName) return Alert.alert('ข้อผิดพลาด', 'กรุณากรอกชื่อร้านค้า');
    if (!description) return Alert.alert('ข้อผิดพลาด', 'กรุณากรอกรายละเอียดร้านค้า');
    if (!address) return Alert.alert('ข้อผิดพลาด', 'กรุณากรอกที่อยู่ร้านค้า');
    if (!agreed) return Alert.alert('ข้อผิดพลาด', 'กรุณายอมรับข้อกำหนดและเงื่อนไข');
    submitRegistration();
  };

  const submitRegistration = async () => {
    setLoading(true);
    try {
      let userId = 999; // Mock user ID that definitely has no shop
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        if (parsed?.user_id) userId = parsed.user_id;
      }

      const formData = new FormData();
      formData.append('owner_id', userId.toString());
      formData.append('name', shopName);
      formData.append('description', description);
      formData.append('category_id', categoryId.toString());
      formData.append('address', address);
      formData.append('latitude', latitude.toString());
      formData.append('longitude', longitude.toString());
      formData.append('bank_name', bankName);
      formData.append('bank_account', bankAccount);

      if (idCardImage && !idCardImage.startsWith('http')) {
        const filename = idCardImage.split('/').pop() || 'idcard.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1].toLowerCase() : 'jpg';
        formData.append('id_card_image', {
          uri: idCardImage,
          name: filename,
          type: ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
        } as any);
      }

      if (bookbankImage && !bookbankImage.startsWith('http')) {
        const filename = bookbankImage.split('/').pop() || 'bookbank.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1].toLowerCase() : 'jpg';
        formData.append('bookbank_image', {
          uri: bookbankImage,
          name: filename,
          type: ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
        } as any);
      }

      // Use pure XMLHttpRequest to bypass Expo fetch polyfill bugs
      const responseData = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE_URL}/shops/register`);
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(new Error(data.message || data.error || 'เซิร์ฟเวอร์แจ้งข้อผิดพลาด'));
            }
          } catch (e) {
            reject(new Error(`เซิร์ฟเวอร์ส่งกลับมาผิดปกติ: ${xhr.status} - ${xhr.responseText.substring(0, 300)}`));
          }
        };
        xhr.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย'));
        xhr.send(formData);
      });

      if (responseData?.success) {
        setIsPending(true);
        setStep(3);
      } else {
        Alert.alert('ข้อผิดพลาด', responseData?.message || 'ไม่สามารถสมัครร้านค้าได้');
      }
    } catch (error: any) {
      console.error('Register Shop Error:', error);
      Alert.alert('ข้อผิดพลาด', `เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถส่งข้อมูลได้'}`);
    } finally {
      setLoading(false);
    }
  };

  if (isRejected && step === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)/profile')}>
            <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>การตรวจสอบไม่ผ่าน</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <MaterialIcons name="error-outline" size={80} color="#ef4444" />
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 20, color: '#0f172a', textAlign: 'center' }}>คำขอเปิดร้านของคุณไม่ผ่านการอนุมัติ</Text>
          <Text style={{ textAlign: 'center', color: '#ef4444', marginTop: 10, lineHeight: 22, fontWeight: '600' }}>
            เหตุผล: {rejectReason}
          </Text>
          <Text style={{ textAlign: 'center', color: '#64748b', marginTop: 10, lineHeight: 22 }}>
            กรุณาแก้ไขข้อมูลและแนบเอกสารที่ถูกต้องตามที่แจ้งไว้ แล้วส่งคำขอเข้ามาใหม่อีกครั้ง
          </Text>
          <TouchableOpacity 
            style={[styles.submitBtn, { width: '100%', marginTop: 30 }]} 
            onPress={() => {
              setStep(1); // go to form
            }}
          >
            <Text style={styles.submitBtnText}>แก้ไขข้อมูลและส่งใหม่</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isPending || step === 3) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)/profile')}>
            <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>รอการตรวจสอบ</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <MaterialIcons name="hourglass-empty" size={80} color="#f59e0b" />
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 20, color: '#0f172a' }}>รอผู้ดูแลระบบตรวจสอบ</Text>
          <Text style={{ textAlign: 'center', color: '#64748b', marginTop: 10, lineHeight: 22 }}>
            ข้อมูลร้านค้าของคุณถูกส่งเรียบร้อยแล้ว กรุณารอผู้ดูแลระบบตรวจสอบและอนุมัติภายใน 1-3 วันทำการ
          </Text>
          <TouchableOpacity 
            style={[styles.submitBtn, { width: '100%', marginTop: 30 }]} 
            onPress={() => router.replace('/(tabs)/profile')}
          >
            <Text style={styles.submitBtnText}>กลับหน้าโปรไฟล์</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => step === 2 ? setStep(1) : router.replace('/(tabs)/profile')}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ลงทะเบียนร้านค้า (ขั้นตอน {step}/2)</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {step === 1 && (
          <View>
            <View style={styles.titleContainer}>
              <Text style={styles.pageTitle}>ข้อมูลเจ้าของร้าน & ธนาคาร</Text>
              <Text style={styles.pageSubtitle}>กรุณากรอกข้อมูลเพื่อใช้ยืนยันตัวตนและรับเงิน</Text>
            </View>

            {/* ID Card */}
            <Text style={styles.inputLabel}>รูปถ่ายบัตรประชาชน</Text>
            <TouchableOpacity style={styles.uploadCard} onPress={() => pickImage(setIdCardImage)}>
              {idCardImage ? (
                <Image source={{ uri: idCardImage }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <MaterialIcons name="add-a-photo" size={32} color="#94a3b8" />
                  <Text style={styles.uploadText}>กดเพื่ออัปโหลด หรือถ่ายรูปหน้าบัตรประชาชน</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Bank Name */}
            <Text style={styles.inputLabel}>เลือกธนาคารรับเงิน</Text>
            <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowBankDropdown(!showBankDropdown)}>
              <Text style={styles.dropdownText}>{bankName}</Text>
              <MaterialIcons name={showBankDropdown ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color="#64748b" />
            </TouchableOpacity>
            {showBankDropdown && (
              <View style={styles.dropdownMenu}>
                {bankList.map(b => (
                  <TouchableOpacity key={b} style={styles.dropdownItem} onPress={() => { setBankName(b); setShowBankDropdown(false); }}>
                    <Text style={styles.dropdownItemText}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Bank Account */}
            <Text style={styles.inputLabel}>เลขที่บัญชีธนาคาร</Text>
            <TextInput
              style={styles.textInput}
              placeholder="เช่น 123-4-56789-0"
              keyboardType="number-pad"
              value={bankAccount}
              onChangeText={setBankAccount}
            />

            {/* Bookbank Image */}
            <Text style={styles.inputLabel}>รูปหน้าสมุดบัญชี (Bookbank)</Text>
            <TouchableOpacity style={styles.uploadCard} onPress={() => pickImage(setBookbankImage)}>
              {bookbankImage ? (
                <Image source={{ uri: bookbankImage }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <MaterialIcons name="account-balance-wallet" size={32} color="#94a3b8" />
                  <Text style={styles.uploadText}>กดเพื่ออัปโหลด รูปหน้าสมุดบัญชี</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitBtn} onPress={validateStep1}>
              <Text style={styles.submitBtnText}>ถัดไป</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View>
            <View style={styles.titleContainer}>
              <Text style={styles.pageTitle}>ข้อมูลร้านค้า & ที่ตั้ง</Text>
              <Text style={styles.pageSubtitle}>ระบุรายละเอียดเพื่อให้ลูกค้าค้นหาร้านคุณเจอ</Text>
            </View>

            <Text style={styles.inputLabel}>ชื่อร้านค้า</Text>
            <TextInput
              style={styles.textInput}
              placeholder="ตั้งชื่อร้านค้าของคุณ..."
              value={shopName}
              onChangeText={setShopName}
            />

            <Text style={styles.inputLabel}>รายละเอียดร้านค้า</Text>
            <TextInput
              style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
              placeholder="บอกเล่าเรื่องราวร้านของคุณ หรือจุดเด่นอาหาร"
              multiline
              value={description}
              onChangeText={setDescription}
            />

            <Text style={styles.inputLabel}>หมวดหมู่หลัก</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {categories.map(c => (
                <TouchableOpacity 
                  key={c.category_id || c.name} 
                  style={[styles.catPill, categoryId === (c.category_id || 1) && styles.catPillActive]}
                  onPress={() => setCategoryId(c.category_id || 1)}
                >
                  <Text style={[styles.catPillText, categoryId === (c.category_id || 1) && styles.catPillTextActive]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>ที่ตั้งร้านค้า (เลือกตำแหน่งจากแผนที่)</Text>
            <View style={styles.mapCard}>
              <View style={[styles.mapPreview, { padding: 0, overflow: 'hidden' }]}>
                <MapView 
                  style={{ width: '100%', height: '100%' }}
                  initialRegion={{
                    latitude: latitude,
                    longitude: longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  region={{
                    latitude: latitude,
                    longitude: longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  onPress={(e) => {
                    setLatitude(e.nativeEvent.coordinate.latitude);
                    setLongitude(e.nativeEvent.coordinate.longitude);
                  }}
                >
                  <Marker 
                    coordinate={{ latitude, longitude }} 
                    draggable
                    onDragEnd={(e) => {
                      setLatitude(e.nativeEvent.coordinate.latitude);
                      setLongitude(e.nativeEvent.coordinate.longitude);
                    }}
                  />
                </MapView>
              </View>
              <Text style={{ fontSize: 12, color: '#64748b', marginTop: 8, textAlign: 'center' }}>พิกัด: {latitude.toFixed(6)}, {longitude.toFixed(6)}</Text>
              <TextInput
                style={[styles.textInput, { borderWidth: 0, paddingHorizontal: 0, marginTop: 4 }]}
                placeholder="รายละเอียดที่อยู่ (บ้านเลขที่ ซอย ถนน...)"
                multiline
                value={address}
                onChangeText={setAddress}
              />
            </View>

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreed(!agreed)} activeOpacity={0.7}>
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed && <MaterialIcons name="check" size={16} color="#16a34a" />}
              </View>
              <Text style={styles.checkboxText}>
                ฉันยอมรับ <Text style={styles.linkText}>ข้อกำหนดและเงื่อนไข</Text> ในการสมัครเป็นผู้ขาย
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.submitBtn, loading && { opacity: 0.7 }]} 
              onPress={validateStep2}
              disabled={loading}
            >
              <Text style={styles.submitBtnText}>{loading ? 'กำลังส่งข้อมูล...' : 'ยืนยันการสมัคร'}</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  content: { padding: 20, paddingBottom: 50 },
  titleContainer: { marginBottom: 24 },
  pageTitle: { fontSize: 22, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
  pageSubtitle: { fontSize: 14, color: '#64748b', lineHeight: 22 },
  inputLabel: { fontSize: 15, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 16 },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0f172a'
  },
  uploadCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  uploadPlaceholder: { alignItems: 'center' },
  uploadText: { marginTop: 12, color: '#64748b', fontSize: 14 },
  uploadedImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  dropdownBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dropdownText: { fontSize: 15, color: '#0f172a' },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginTop: 4,
    elevation: 2
  },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownItemText: { fontSize: 15, color: '#334155' },
  catPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8
  },
  catPillActive: { backgroundColor: '#16a34a' },
  catPillText: { color: '#64748b', fontWeight: '500' },
  catPillTextActive: { color: '#fff' },
  mapCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 20
  },
  mapPreview: {
    height: 180,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#cbd5e1',
    marginRight: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff'
  },
  checkboxChecked: { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  checkboxText: { flex: 1, fontSize: 14, color: '#475569', lineHeight: 22 },
  linkText: { color: '#16a34a', fontWeight: 'bold' },
  submitBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
