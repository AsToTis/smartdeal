import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, Image, TouchableOpacity, 
  TextInput, ScrollView, Alert, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { BASE_URL } from '../constants/api';


export default function ReviewScreen() {
  const params = useLocalSearchParams();
  const orderId = params.order_id ? Number(params.order_id) : 24;

  // Multiple Shops
  const [shops, setShops] = useState<any[]>([]);
  const [shopRatings, setShopRatings] = useState<Record<number, number>>({});
  const [shopComments, setShopComments] = useState<Record<number, string>>({});
  const [shopPhotos, setShopPhotos] = useState<Record<number, string | null>>({});

  // Fallbacks
  const [productName, setProductName] = useState<string>((params.product_name as string) || 'เมนูอาหาร');
  const [orderDate, setOrderDate] = useState<string>((params.order_date as string) || 'เมื่อสักครู่');
  const [productImage, setProductImage] = useState<string>((params.product_image as string) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600');

  // Rider Details
  const [riderId, setRiderId] = useState<number | null>(params.rider_id ? Number(params.rider_id) : null);
  const [riderName, setRiderName] = useState<string>((params.rider_name as string) || '');
  const [riderVehicle, setRiderVehicle] = useState<string>((params.vehicle_plate as string) || '');
  const [hasRider, setHasRider] = useState<boolean>(true);

  // Ratings & Comments
  const [riderRating, setRiderRating] = useState<number>(5);
  const [riderComment, setRiderComment] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingInfo, setFetchingInfo] = useState<boolean>(false);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) return;
      try {
        setFetchingInfo(true);
        const res = await axios.get(`${BASE_URL}/orders/${orderId}/tracking`);
        if (res.data?.success) {
          const t = res.data;
          
          let fetchedShops = [];
          if (t.shops && t.shops.length > 0) fetchedShops = t.shops;
          else if (t.shop) fetchedShops = [t.shop];
          else if (params.shop_id) {
            fetchedShops = [{ shop_id: params.shop_id, name: params.shop_name }];
          }
          setShops(fetchedShops);

          const initRatings: Record<number, number> = {};
          fetchedShops.forEach((s: any) => initRatings[s.shop_id || 0] = 5);
          setShopRatings(initRatings);

          if (t.rider) {
            setHasRider(true);
            if (t.rider.rider_id) setRiderId(t.rider.rider_id);
            if (t.rider.name) setRiderName(t.rider.name);
            if (t.rider.vehicle_plate || t.rider.vehicle) {
              setRiderVehicle(t.rider.vehicle_plate || t.rider.vehicle);
            }
          }
        }
      } catch (e) {
        console.log('Notice: Auto-fetch order details for review:', e);
      } finally {
        setFetchingInfo(false);
      }
    };
    fetchOrderDetails();
  }, [orderId]);

  // Image Picker from Gallery
  const handlePickImage = async (sId: number) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('การเข้าถึงรูปภาพ', 'กรุณาอนุญาตการเข้าถึงคลังรูปภาพเพื่อเลือกรูปภาพประกอบรีวิว');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setShopPhotos(prev => ({ ...prev, [sId]: result.assets[0].uri }));
      }
    } catch (error) {
      console.error('Pick image error:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเลือกรูปภาพได้');
    }
  };

  // Take photo from camera
  const handleTakePhoto = async (sId: number) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('การเข้าถึงกล้อง', 'กรุณาอนุญาตการเข้าถึงกล้องถ่ายรูป');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        setShopPhotos(prev => ({ ...prev, [sId]: result.assets[0].uri }));
      }
    } catch (error) {
      console.error('Take photo error:', error);
    }
  };

  const showPhotoOptions = (sId: number) => {
    Alert.alert(
      'แนบรูปภาพอาหารประกอบรีวิว 📷',
      'เลือกรูปภาพอาหารของคุณเพื่อเพิ่มความน่าเชื่อถือให้กับรีวิว',
      [
        { text: 'ถ่ายรูปใหม่ 📸', onPress: () => handleTakePhoto(sId) },
        { text: 'เลือกจากคลังภาพ 🖼️', onPress: () => handlePickImage(sId) },
        { text: 'ยกเลิก', style: 'cancel' }
      ]
    );
  };

  const handleRemovePhoto = (sId: number) => {
    setShopPhotos(prev => ({ ...prev, [sId]: null }));
  };

  const handleSubmitReview = async () => {
    try {
      setLoading(true);
      let userId = 2;
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const u = JSON.parse(userData);
          if (u?.user_id) userId = u.user_id;
        }
      } catch (e) {}

      // Submit for all shops
      const shopsToSubmit = shops.length > 0 ? shops : [{ shop_id: params.shop_id }];
      
      for (let i = 0; i < shopsToSubmit.length; i++) {
        const s = shopsToSubmit[i];
        const sId = s.shop_id || 0;
        const isFirst = i === 0; // Rider rating is sent ONLY with the first shop's review

        let uploadedImageUrl: string | null = null;
        const localPhotoUri = shopPhotos[sId];
        if (localPhotoUri) {
          try {
            const uriParts = localPhotoUri.split('.');
            const fileType = uriParts[uriParts.length - 1] || 'jpg';
            const uploadFormData = new FormData();
            uploadFormData.append('image', {
              uri: localPhotoUri,
              name: `review_${orderId}_${sId}_${Date.now()}.${fileType}`,
              type: `image/${fileType}`
            } as any);

            const uploadRes = await axios.post(`${BASE_URL}/reviews/upload`, uploadFormData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (uploadRes.data?.success && uploadRes.data?.image_url) {
              uploadedImageUrl = uploadRes.data.image_url;
            }
          } catch (err: any) {
            console.error('Failed to upload review image, proceeding without it:', err?.message);
          }
        }
        
        await axios.post(`${BASE_URL}/reviews`, {
          order_id: orderId,
          user_id: userId,
          shop_id: s.shop_id || null,
          rating: shopRatings[sId] || 5,
          comment: shopComments[sId] || '',
          image_url: uploadedImageUrl,
          rider_id: isFirst ? riderId : null,
          rider_rating: (hasRider && isFirst) ? riderRating : null,
          rider_comment: (hasRider && isFirst) ? riderComment : null
        });
      }

      // Mark order as reviewed in AsyncStorage to prevent duplicate reviews
      try {
        const storedReviewed = await AsyncStorage.getItem('reviewedOrders');
        const reviewedArr = storedReviewed ? JSON.parse(storedReviewed) : [];
        if (!reviewedArr.includes(orderId)) {
          reviewedArr.push(orderId);
          await AsyncStorage.setItem('reviewedOrders', JSON.stringify(reviewedArr));
        }
      } catch (e) {
        console.error('Failed to save reviewed status to AsyncStorage:', e);
      }

      Alert.alert(
        'รีวิวสำเร็จ ✨', 
        'ขอบคุณสำหรับการให้คะแนน! คุณได้รับโบนัสแต้ม +50 พอยท์เรียบร้อยแล้ว', 
        [
          {
            text: 'ดูรายการคำสั่งซื้อ',
            onPress: () => router.replace('/(tabs)/orders' as any)
          }
        ]
      );
    } catch (error: any) {
      console.error('Submit review error:', error);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกรีวิวได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง', [
        { text: 'ตกลง', onPress: () => router.back() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ให้คะแนนและรีวิว</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        {/* ======================================================== */}
        {/* PART 1: ร้านค้าและอาหาร (Shop & Food Rating) */}
        {/* ======================================================== */}
        {(shops.length > 0 ? shops : [{ shop_id: params.shop_id, name: params.shop_name }]).map((s: any, idx: number) => {
          const sId = s.shop_id || 0;
          return (
            <View key={sId || idx} style={[styles.reviewCard, { marginBottom: 16 }]}>
              <View style={styles.cardBadge}>
                <MaterialIcons name="storefront" size={16} color="#16a34a" />
                <Text style={styles.cardBadgeText}>รีวิวร้านค้า {shops.length > 1 ? `(ร้านที่ ${idx+1})` : '& เมนูอาหาร'}</Text>
              </View>

              <View style={styles.productInfoRow}>
                <Image 
                  source={{ uri: s.image_url || s.shop_image || productImage }} 
                  style={styles.foodThumb} 
                />
                <View style={styles.productDetails}>
                  <Text style={styles.foodTitle} numberOfLines={1}>{shops.length > 1 ? 'ออเดอร์จากร้าน' : productName}</Text>
                  <Text style={styles.shopNameText} numberOfLines={1}>{s.name || params.shop_name || 'ร้านค้า'}</Text>
                  <Text style={styles.orderDateText}>วันที่สั่ง: {orderDate}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <Text style={styles.ratingQuestion}>รสชาติและความพึงพอใจของอาหาร</Text>

              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((starNum) => {
                  const currentShopRating = shopRatings[sId] || 5;
                  const isSelected = starNum <= currentShopRating;
                  return (
                    <TouchableOpacity
                      key={starNum}
                      style={styles.starCol}
                      onPress={() => setShopRatings(prev => ({...prev, [sId]: starNum}))}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.starCircle, isSelected && styles.starCircleActive]}>
                        <MaterialIcons 
                          name={isSelected ? 'star' : 'star-border'} 
                          size={28} 
                          color={isSelected ? '#16a34a' : '#94a3b8'} 
                        />
                      </View>
                      <Text style={[styles.starNumber, isSelected && styles.starNumberActive]}>
                        {starNum}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionHeading}>ความคิดเห็นเกี่ยวกับอาหาร/ร้านค้า</Text>
              <View style={styles.textareaContainer}>
                <TextInput
                  style={styles.textarea}
                  multiline
                  placeholder="รสชาติอร่อยไหม? ปริมาณเหมาะสมและตรงปกหรือไม่..."
                  placeholderTextColor="#94a3b8"
                  value={shopComments[sId] || ''}
                  onChangeText={(val) => setShopComments(prev => ({...prev, [sId]: val}))}
                />
                <MaterialIcons name="edit" size={14} color="#cbd5e1" style={styles.textareaCornerIcon} />
              </View>

              {/* แนบรูปภาพอาหาร */}
              <Text style={styles.sectionHeading}>แนบรูปภาพอาหารประกอบรีวิว (ถ้ามี)</Text>
              {shopPhotos[sId] ? (
                <View style={styles.selectedPhotoWrapper}>
                  <Image source={{ uri: shopPhotos[sId]! }} style={styles.selectedPhotoPreview} />
                  <View style={styles.photoActionButtons}>
                    <TouchableOpacity 
                      style={styles.changePhotoBtn} 
                      onPress={() => showPhotoOptions(sId)}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="photo-camera" size={15} color="#16a34a" />
                      <Text style={styles.changePhotoBtnText}>เปลี่ยนรูปภาพ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.removePhotoBtn} 
                      onPress={() => handleRemovePhoto(sId)}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="delete-outline" size={15} color="#ef4444" />
                      <Text style={styles.removePhotoBtnText}>ลบรูป</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.addPhotoCard}
                  onPress={() => showPhotoOptions(sId)}
                  activeOpacity={0.75}
                >
                  <View style={styles.addPhotoIconCircle}>
                    <MaterialIcons name="add-a-photo" size={22} color="#16a34a" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.addPhotoTitle}>แนบรูปภาพอาหาร</Text>
                    <Text style={styles.addPhotoDesc}>เลือกจากคลังภาพ หรือถ่ายรูปอาหารจริง</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        
        {/* ======================================================== */}
        {/* PART 2: พนักงานส่งของ (Rider & Delivery Rating) */}
        {/* ======================================================== */}
        {hasRider && (
          <View style={[styles.reviewCard, styles.riderCard]}>
            <View style={[styles.cardBadge, styles.riderBadge]}>
              <MaterialIcons name="two-wheeler" size={16} color="#d97706" />
              <Text style={[styles.cardBadgeText, { color: '#d97706' }]}>รีวิวการจัดส่ง & ไรเดอร์</Text>
            </View>

            <View style={styles.riderProfileRow}>
              <View style={styles.riderAvatarBox}>
                <MaterialIcons name="person" size={28} color="#d97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.riderNameText}>
                  {riderName || 'พนักงานจัดส่ง Smart Deal'}
                </Text>
                <Text style={styles.riderVehicleText}>
                  {riderVehicle ? `ยานพาหนะ: ${riderVehicle}` : 'จัดส่งด้วยมอเตอร์ไซค์'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={[styles.ratingQuestion, { color: '#d97706' }]}>
              ความสุภาพและความรวดเร็วในการส่ง
            </Text>

            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((starNum) => {
                const isSelected = starNum <= riderRating;
                return (
                  <TouchableOpacity
                    key={starNum}
                    style={styles.starCol}
                    onPress={() => setRiderRating(starNum)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.starCircle, isSelected && styles.riderStarCircleActive]}>
                      <MaterialIcons 
                        name={isSelected ? 'star' : 'star-border'} 
                        size={28} 
                        color={isSelected ? '#f59e0b' : '#94a3b8'} 
                      />
                    </View>
                    <Text style={[styles.starNumber, isSelected && { color: '#d97706', fontWeight: 'bold' }]}>
                      {starNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionHeading}>ความคิดเห็นเกี่ยวกับพนักงานส่งของ</Text>
            <View style={styles.textareaContainer}>
              <TextInput
                style={styles.textarea}
                multiline
                placeholder="พนักงานสุภาพไหม? จัดส่งรวดเร็วและโทรแจ้งก่อนหรือไม่..."
                placeholderTextColor="#94a3b8"
                value={riderComment}
                onChangeText={setRiderComment}
              />
              <MaterialIcons name="two-wheeler" size={14} color="#cbd5e1" style={styles.textareaCornerIcon} />
            </View>
          </View>
        )}

        {/* 6. ปุ่มส่งรีวิว */}
        <TouchableOpacity 
          style={styles.submitBtn} 
          onPress={handleSubmitReview}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.submitContent}>
              <Text style={styles.submitBtnText}>ส่งคะแนนรีวิว</Text>
              <View style={styles.pointsPill}>
                <Text style={styles.pointsPillText}>+50 แต้ม</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

      </ScrollView>

      {/* 7. Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(tabs)')}>
          <MaterialIcons name="home" size={22} color="#94a3b8" />
          <Text style={styles.navText}>หน้าแรก</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(tabs)/search' as any)}>
          <MaterialIcons name="search" size={22} color="#94a3b8" />
          <Text style={styles.navText}>ค้นหา</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(tabs)/orders' as any)}>
          <MaterialIcons name="shopping-bag" size={22} color="#16a34a" />
          <Text style={[styles.navText, { color: '#16a34a', fontWeight: 'bold' }]}>คำสั่งซื้อ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/(tabs)/profile' as any)}>
          <MaterialIcons name="person" size={22} color="#94a3b8" />
          <Text style={styles.navText}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 40 },

  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  riderCard: {
    borderColor: '#fef3c7'
  },
  cardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12
  },
  riderBadge: {
    backgroundColor: '#fffbeb'
  },
  cardBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#16a34a'
  },
  productInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  foodThumb: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#f1f5f9'
  },
  productDetails: { flex: 1 },
  foodTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 },
  shopNameText: { fontSize: 13, color: '#16a34a', fontWeight: '600', marginBottom: 2 },
  orderDateText: { fontSize: 11, color: '#94a3b8' },

  riderProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  riderAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  riderNameText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  riderVehicleText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },

  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14
  },
  ratingQuestion: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#16a34a',
    textAlign: 'center',
    marginBottom: 14
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    marginBottom: 16
  },
  starCol: { alignItems: 'center' },
  starCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  starCircleActive: { 
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac'
  },
  riderStarCircleActive: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a'
  },
  starNumber: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  starNumberActive: { color: '#0f172a', fontWeight: 'bold' },

  sectionHeading: { fontSize: 13, fontWeight: 'bold', color: '#334155', marginBottom: 8 },
  textareaContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    minHeight: 80,
    position: 'relative',
    marginBottom: 12
  },
  textarea: { fontSize: 13, color: '#0f172a', lineHeight: 18, textAlignVertical: 'top' },
  textareaCornerIcon: { position: 'absolute', bottom: 8, right: 8 },

  addPhotoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderStyle: 'dashed',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 4
  },
  addPhotoIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  addPhotoDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  selectedPhotoWrapper: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  selectedPhotoPreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  photoActionButtons: {
    flex: 1,
    gap: 8,
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  changePhotoBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  removePhotoBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ef4444',
  },

  submitBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    marginVertical: 8
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  pointsPill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  pointsPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },

  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 16
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 10, color: '#94a3b8', marginTop: 2 }
});
