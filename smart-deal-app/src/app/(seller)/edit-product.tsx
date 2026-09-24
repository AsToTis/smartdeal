import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../../constants/api';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams();
  
  const [name, setName] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [expiryDate, setExpiryDate] = useState(''); // Simple text input for now
  const [stockQuantity, setStockQuantity] = useState('');
  const [categoryId, setCategoryId] = useState('1');
  const [description, setDescription] = useState('');
  const [notifyNearby, setNotifyNearby] = useState(true);
  const [isAuction, setIsAuction] = useState(false);

  // Mock image
  const [imageUri, setImageUri] = useState('https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300');
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
          setOriginalPrice(p.original_price ? p.original_price.toString() : '');
          setDiscountPrice(p.discount_price ? p.discount_price.toString() : '');
          setStockQuantity(p.stock_quantity ? p.stock_quantity.toString() : '');
          setDescription(p.description || '');
          setIsAuction(p.is_auction === 1);
          if (p.image_url) setImageUri(p.image_url);
          if (p.expiry_time) {
            const date = new Date(p.expiry_time);
            setExpiryDate(`${date.getMonth()+1}/${date.getDate()}/${date.getFullYear()}`);
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
    if (!name || !originalPrice || !stockQuantity) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    try {
      const shopId = await AsyncStorage.getItem('shop_id');
      if (!shopId) {
        Alert.alert('ข้อผิดพลาด', 'ไม่พบข้อมูลร้านค้า กรุณาเข้าสู่ระบบใหม่');
        return;
      }

      // Helper function to mock expiry time based on date format
      // Ideally we use a proper Date Picker component
      let parsedExpiry = null;
      if (expiryDate) {
        parsedExpiry = new Date(expiryDate);
        if (isNaN(parsedExpiry.getTime())) {
          parsedExpiry = new Date(); // fallback to today if invalid
          parsedExpiry.setHours(parsedExpiry.getHours() + 24);
        }
      }

      const productData = {
        name,
        category_id: parseInt(categoryId),
        original_price: parseFloat(originalPrice),
        discount_price: discountPrice ? parseFloat(discountPrice) : null,
        stock_quantity: parseInt(stockQuantity),
        description,
        image_url: imageUri,
        is_auction: isAuction,
        expiry_time: parsedExpiry ? parsedExpiry.toISOString() : null,
        deal_end_time: parsedExpiry ? parsedExpiry.toISOString() : null
      };

      const res = await axios.put(`${BASE_URL}/shops/${shopId}/products/${id}`, productData);
      
      if (res.data?.success) {
        Alert.alert('สำเร็จ', 'แก้ไขสินค้าเรียบร้อยแล้ว', [
          { text: 'ตกลง', onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      console.error('Edit product error:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถแก้ไขสินค้าได้');
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
          <TouchableOpacity style={styles.addImageBtn} activeOpacity={0.7}>
            <MaterialIcons name="add-a-photo" size={28} color="#2e7a32" />
            <Text style={styles.addImageText}>เพิ่มรูปภาพ</Text>
          </TouchableOpacity>
          <View style={styles.imagePreviewWrapper}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            <TouchableOpacity style={styles.removeImageBtn}>
              <MaterialIcons name="close" size={14} color="#ef4444" />
            </TouchableOpacity>
          </View>
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

        {/* หมดอายุ & จำนวน */}
        <View style={styles.rowGrid}>
          <View style={styles.colHalf}>
            <Text style={styles.inputLabel}>วันหมดอายุของดีล</Text>
            <View style={styles.inputWithIcon}>
              <TextInput
                style={styles.inputField}
                placeholder="mm/dd/yyyy"
                value={expiryDate}
                onChangeText={setExpiryDate}
              />
              <MaterialIcons name="calendar-today" size={18} color="#94a3b8" />
            </View>
          </View>
          <View style={styles.colHalf}>
            <Text style={styles.inputLabel}>จำนวนสินค้าที่มี</Text>
            <TextInput
              style={styles.input}
              placeholder="ระบุจำนวน"
              keyboardType="numeric"
              value={stockQuantity}
              onChangeText={setStockQuantity}
            />
          </View>
        </View>

        {/* หมวดหมู่ */}
        <Text style={styles.inputLabel}>หมวดหมู่สินค้า</Text>
        <View style={styles.pickerFake}>
          <Text style={styles.pickerFakeText}>เลือกหมวดหมู่</Text>
          <MaterialIcons name="keyboard-arrow-down" size={24} color="#94a3b8" />
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
          </View>
          <Switch
            trackColor={{ false: '#cbd5e1', true: '#d97706' }}
            thumbColor={'#fff'}
            value={isAuction}
            onValueChange={setIsAuction}
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
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>บันทึกสินค้า</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
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
});
