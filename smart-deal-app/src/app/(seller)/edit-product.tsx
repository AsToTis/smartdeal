import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { BASE_URL } from '../../constants/api';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams();
  
  const [name, setName] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [expiryDate, setExpiryDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const onChangeDate = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setHours(expiryDate.getHours(), expiryDate.getMinutes(), 0, 0);
      setExpiryDate(newDate);
    }
  };

  const onChangeTime = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(expiryDate);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
      setExpiryDate(newDate);
    }
  };
  const [stockQuantity, setStockQuantity] = useState('');
  const [categoryId, setCategoryId] = useState('1');
  const [description, setDescription] = useState('');
  const [notifyNearby, setNotifyNearby] = useState(true);
  const [isAuction, setIsAuction] = useState(false);
  const [initialIsAuction, setInitialIsAuction] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggleAuction = (value: boolean) => {
    if (value) {
      Alert.alert(
        'ยืนยันการตั้งเป็นสินค้าประมูล',
        'คุณแน่ใจหรือไม่ว่าต้องการตั้งสินค้านี้เข้าสู่ห้องประมูล? (หากตั้งเป็นประมูลแล้ว ระบบจะเปิดให้ลูกค้าประมูลทันทีตามเงื่อนไข)',
        [
          { text: 'ยกเลิก', style: 'cancel', onPress: () => setIsAuction(false) },
          { text: 'ยืนยัน', style: 'destructive', onPress: () => setIsAuction(true) }
        ]
      );
    } else {
      setIsAuction(false);
    }
  };

  const isExpiringSoon = () => {
    const now = new Date().getTime();
    const exp = new Date(expiryDate).getTime();
    const diffHours = (exp - now) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 24;
  };

  const [imageUri, setImageUri] = useState('');

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (!id) return;
    const fetchProduct = async () => {
      try {
        const shopId = await AsyncStorage.getItem('shop_id');
        const res = await axios.get(`${BASE_URL}/shops/${shopId}/products/${id}`);
        if (res.data?.success) {
          const p = res.data.product;
          setName(p.name || '');
          if (p.category_id) setCategoryId(p.category_id.toString());
          setOriginalPrice(p.original_price ? p.original_price.toString() : '');
          setDiscountPrice(p.discount_price ? p.discount_price.toString() : '');
          setStockQuantity(p.stock_quantity ? p.stock_quantity.toString() : '');
          setDescription(p.description || '');
          setIsAuction(p.is_auction === 1);
            setInitialIsAuction(p.is_auction === 1);
          if (p.image_url) setImageUri(p.image_url);
          if (p.deal_end_time || p.expiry_time) {
            // Use deal_end_time first because backend formats it correctly, expiry_time may be {}
            const rawDate = p.deal_end_time || p.expiry_time;
            const dateStr = typeof rawDate === 'string' ? rawDate.replace(' ', 'T') : rawDate;
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              setExpiryDate(date);
            } else {
              setExpiryDate(new Date());
            }
          } else {
            setExpiryDate(new Date());
          }
        }
      } catch (error) {
        console.error('Error fetching product details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handleSave = async () => {
    if (initialIsAuction) {
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถแก้ไขสินค้าได้ในขณะที่กำลังอยู่ในห้องประมูล');
      return;
    }
    if (isSaving) return;
    
    if (!name || !originalPrice || !stockQuantity) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    setIsSaving(true);
    try {
      const shopId = await AsyncStorage.getItem('shop_id');
      if (!shopId) {
        Alert.alert('ข้อผิดพลาด', 'ไม่พบข้อมูลร้านค้า กรุณาเข้าสู่ระบบใหม่');
        return;
      }

      let parsedExpiry = new Date(expiryDate);

      const formData = new FormData();
      formData.append('name', name);
      formData.append('category_id', categoryId);
      formData.append('original_price', originalPrice);
      formData.append('discount_price', discountPrice || '0');
      formData.append('stock_quantity', stockQuantity);
      formData.append('description', description);
      formData.append('is_auction', isAuction ? '1' : '0');
      if (parsedExpiry) {
        formData.append('expiry_time', parsedExpiry.toISOString());
        formData.append('deal_end_time', parsedExpiry.toISOString());
      }
      
      if (imageUri) {
        if (!imageUri.startsWith('http')) {
          const filename = imageUri.split('/').pop() || 'product.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;
          formData.append('image', { uri: imageUri, name: filename, type } as any);
        } else {
          formData.append('image_url', imageUri);
        }
      }

      const responseData = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE_URL}/shops/${shopId}/products/${id}`);
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(new Error(data.message || 'เซิร์ฟเวอร์แจ้งข้อผิดพลาด'));
            }
          } catch (e) {
            reject(new Error('เซิร์ฟเวอร์ส่งข้อมูลกลับมาผิดพลาด'));
          }
        };
        xhr.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย'));
        xhr.send(formData);
      });
      
      if (responseData?.success) {
        Alert.alert('สำเร็จ', 'แก้ไขสินค้าเรียบร้อยแล้ว', [
          { text: 'ตกลง', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('ผิดพลาด', responseData?.message || 'ไม่สามารถแก้ไขสินค้าได้');
      }
    } catch (error: any) {
      console.error('Edit product error:', error);
      Alert.alert('ผิดพลาด', `เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถแก้ไขสินค้าได้'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#2e7a32" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>แก้ไขสินค้า</Text>
        <View style={styles.helpBtn}>
          <MaterialIcons name="help" size={20} color="#2e7a32" />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* รูปภาพสินค้า */}
        <Text style={styles.sectionLabel}>รูปภาพสินค้า</Text>
        <View style={styles.imageSection}>
          <TouchableOpacity style={styles.addImageBtn} activeOpacity={0.7} onPress={pickImage}>
            <MaterialIcons name="add-a-photo" size={28} color="#2e7a32" />
            <Text style={styles.addImageText}>เปลี่ยนรูปภาพ</Text>
          </TouchableOpacity>
          {imageUri ? (
            <View style={styles.imagePreviewWrapper}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri('')}>
                <MaterialIcons name="close" size={14} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* ชื่อสินค้า */}
        <Text style={styles.inputLabel}>ชื่อสินค้า</Text>
        <TextInput
          style={styles.input}
          placeholder="ระบุชื่อสินค้า (เช่น ข้าวผัดกะเพราไข่ดาว)"
          value={name}
          onChangeText={setName}
        />

        {/* ราคา */}
        <View style={styles.rowGrid}>
          <View style={styles.colHalf}>
            <Text style={styles.inputLabel}>ราคาปกติ</Text>
            <View style={styles.inputWithIcon}>
              <Text style={styles.currencySymbol}>฿</Text>
              <TextInput
                style={styles.inputField}
                placeholder="0.00"
                keyboardType="numeric"
                value={originalPrice}
                onChangeText={setOriginalPrice}
              />
            </View>
          </View>
          <View style={styles.colHalf}>
            <Text style={[styles.inputLabel, { color: '#2e7a32' }]}>ราคาส่วนลด (Deal)</Text>
            <View style={[styles.inputWithIcon, { borderColor: '#2e7a32', backgroundColor: '#f0fdf4' }]}>
              <Text style={[styles.currencySymbol, { color: '#2e7a32' }]}>฿</Text>
              <TextInput
                style={styles.inputField}
                placeholder="0.00"
                keyboardType="numeric"
                value={discountPrice}
                onChangeText={setDiscountPrice}
              />
            </View>
          </View>
        </View>

        {/* วันที่และเวลาหมดอายุของดีล (ระดับชั่วโมง/นาที) */}
        <View style={styles.rowGrid}>
          <View style={styles.colHalf}>
            <Text style={styles.inputLabel}>วันหมดอายุของดีล</Text>
            <TouchableOpacity style={styles.inputWithIcon} onPress={() => setShowDatePicker(true)}>
              <Text style={{ flex: 1, color: '#0f172a', fontSize: 13 }} numberOfLines={1}>
                {isNaN(expiryDate.getTime()) ? 'เลือกวันที่' : expiryDate.toLocaleDateString('th-TH')}
              </Text>
              <MaterialIcons name="calendar-today" size={18} color="#94a3b8" />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={isNaN(expiryDate.getTime()) ? new Date() : expiryDate}
                mode="date"
                display="default"
                onChange={onChangeDate}
                minimumDate={new Date()}
              />
            )}
          </View>
          <View style={styles.colHalf}>
            <Text style={styles.inputLabel}>เวลาหมดอายุ</Text>
            <TouchableOpacity style={styles.inputWithIcon} onPress={() => setShowTimePicker(true)}>
              <Text style={{ flex: 1, color: '#0f172a', fontSize: 13 }} numberOfLines={1}>
                {isNaN(expiryDate.getTime()) ? 'เลือกเวลา' : expiryDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'}
              </Text>
              <MaterialIcons name="access-time" size={18} color="#2e7a32" />
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={isNaN(expiryDate.getTime()) ? new Date() : expiryDate}
                mode="time"
                display="default"
                onChange={onChangeTime}
              />
            )}
          </View>
        </View>

        {/* จำนวนสินค้า */}
        <Text style={styles.inputLabel}>จำนวนสินค้าที่มี</Text>
        <TextInput
          style={styles.input}
          placeholder="ระบุจำนวน"
          keyboardType="numeric"
          value={stockQuantity}
          onChangeText={setStockQuantity}
        />

        {/* หมวดหมู่ */}
        <Text style={styles.inputLabel}>หมวดหมู่สินค้า</Text>
        <View style={[styles.input, { padding: 0, justifyContent: 'center' }]}>
          <Picker
            selectedValue={categoryId}
            onValueChange={(itemValue) => setCategoryId(itemValue)}
            style={{ width: '100%', color: '#0f172a' }}
          >
            <Picker.Item label="เบเกอรี่" value="1" />
            <Picker.Item label="อาหารมื้อหลัก" value="2" />
            <Picker.Item label="ผลไม้" value="3" />
            <Picker.Item label="เครื่องดื่ม" value="4" />
            <Picker.Item label="ขนมหวาน" value="5" />
          </Picker>
        </View>

        {/* รายละเอียด */}
        <Text style={styles.inputLabel}>รายละเอียดเพิ่มเติม</Text>
        <TextInput
          style={styles.textArea}
          placeholder="ระบุรายละเอียด เช่น เวลาที่ควรมารับสินค้า"
          multiline={true}
          numberOfLines={4}
          textAlignVertical="top"
          value={description}
          onChangeText={setDescription}
        />

        {/* การประมูล */}
        <View style={styles.notifyCard}>
          <View style={[styles.notifyIconCircle, { backgroundColor: '#fef3c7' }]}>
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
            onValueChange={handleToggleAuction}
            disabled={!isExpiringSoon()}
          />
        </View>

        {/* การแจ้งเตือน */}
        <View style={styles.notifyCard}>
          <View style={styles.notifyIconCircle}>
            <MaterialIcons name="notifications-active" size={20} color="#2e7a32" />
          </View>
          <View style={styles.notifyTextWrapper}>
            <Text style={styles.notifyTitle}>แจ้งเตือนลูกค้าละแวกใกล้เคียง</Text>
            <Text style={styles.notifyDesc}>ส่งแจ้งเตือนเมื่อลงสินค้าใหม่ทันที</Text>
          </View>
          <Switch
            trackColor={{ false: '#cbd5e1', true: '#2e7a32' }}
            thumbColor={'#fff'}
            value={notifyNearby}
            onValueChange={setNotifyNearby}
          />
        </View>

        {/* ปุ่มบันทึก */}
        <TouchableOpacity 
          style={[styles.saveBtn, initialIsAuction && { backgroundColor: '#94a3b8' }, isSaving && { opacity: 0.7 }]} 
          onPress={handleSave} 
          disabled={initialIsAuction || isSaving}
        >
          {isSaving ? (
            <Text style={styles.saveBtnText}>กำลังบันทึก...</Text>
          ) : (
            <Text style={styles.saveBtnText}>บันทึกสินค้า</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} disabled={isSaving}>
          <Text style={styles.cancelBtnText}>ยกเลิก</Text>
        </TouchableOpacity>

        {/* Stepper Fake at bottom */}
        <View style={styles.stepperContainer}>
          <View style={[styles.stepDot, styles.stepActive, { width: 32 }]} />
          <View style={styles.stepDot} />
          <View style={styles.stepDot} />
        </View>

      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  helpBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  imageSection: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  addImageBtn: {
    flex: 1,
    height: 120,
    borderWidth: 2,
    borderColor: '#bbf7d0',
    borderStyle: 'dashed',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
  },
  addImageText: {
    marginTop: 8,
    fontSize: 13,
    color: '#2e7a32',
  },
  imagePreviewWrapper: {
    width: 120,
    height: 120,
    borderRadius: 16,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    marginBottom: 16,
  },
  rowGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  colHalf: {
    flex: 1,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 54,
  },
  currencySymbol: {
    fontSize: 16,
    color: '#94a3b8',
    marginRight: 8,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
  },
  pickerFake: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  pickerFakeText: {
    fontSize: 15,
    color: '#475569',
  },
  textArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    marginBottom: 16,
    minHeight: 100,
  },
  notifyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#dcfce7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
  },
  notifyIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifyTextWrapper: {
    flex: 1,
  },
  notifyTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  notifyDesc: {
    fontSize: 12,
    color: '#64748b',
  },
  saveBtn: {
    backgroundColor: '#2e7a32',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 30,
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#cbd5e1',
  },
  stepActive: {
    backgroundColor: '#2e7a32',
  },
  presetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: -8,
  },
  presetLabel: {
    fontSize: 12,
    color: '#64748b',
    marginRight: 8,
    fontWeight: '600',
  },
  presetScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  presetChip: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  presetChipText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
  },
});
