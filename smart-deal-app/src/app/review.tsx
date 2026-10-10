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
import { BASE_URL } from '../constants/api';

export default function ReviewScreen() {
  const params = useLocalSearchParams();
  const orderId = params.order_id ? Number(params.order_id) : 24;

  // Shop & Food Details
  const [shopId, setShopId] = useState<number | null>(params.shop_id ? Number(params.shop_id) : null);
  const [productName, setProductName] = useState<string>((params.product_name as string) || 'เมนูอาหาร');
  const [shopName, setShopName] = useState<string>((params.shop_name as string) || 'ร้านค้า');
  const [orderDate, setOrderDate] = useState<string>((params.order_date as string) || 'เมื่อสักครู่');
  const [productImage, setProductImage] = useState<string>((params.product_image as string) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600');

  // Rider Details
  const [riderId, setRiderId] = useState<number | null>(params.rider_id ? Number(params.rider_id) : null);
  const [riderName, setRiderName] = useState<string>((params.rider_name as string) || '');
  const [riderVehicle, setRiderVehicle] = useState<string>((params.vehicle_plate as string) || '');
  const [hasRider, setHasRider] = useState<boolean>(true);

  // Ratings & Comments
  const [shopRating, setShopRating] = useState<number>(5);
  const [shopComment, setShopComment] = useState<string>('');
  const [hasPhoto, setHasPhoto] = useState<boolean>(false);

  const [riderRating, setRiderRating] = useState<number>(5);
  const [riderComment, setRiderComment] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingInfo, setFetchingInfo] = useState<boolean>(false);

  // Fetch full order tracking info if shop_id or rider_id is missing
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) return;
      try {
        setFetchingInfo(true);
        const res = await axios.get(`${BASE_URL}/orders/${orderId}/tracking`);
        if (res.data?.success) {
          const t = res.data;
          if (t.shop?.name) setShopName(t.shop.name);
          if (t.shop_id) setShopId(t.shop_id);
          if (t.order?.shop_id) setShopId(t.order.shop_id);

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

      await axios.post(`${BASE_URL}/reviews`, {
        order_id: orderId,
        user_id: userId,
        shop_id: shopId,
        rating: shopRating,
        comment: shopComment,
        image_url: hasPhoto ? productImage : null,
        rider_id: riderId,
        rider_rating: hasRider ? riderRating : null,
        rider_comment: hasRider ? riderComment : null
      });

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
        <View style={styles.reviewCard}>
          <View style={styles.cardBadge}>
            <MaterialIcons name="storefront" size={16} color="#16a34a" />
            <Text style={styles.cardBadgeText}>รีวิวร้านค้า & เมนูอาหาร</Text>
          </View>

          <View style={styles.productInfoRow}>
            <Image 
              source={{ uri: productImage }} 
              style={styles.foodThumb} 
            />
            <View style={styles.productDetails}>
              <Text style={styles.foodTitle} numberOfLines={1}>{productName}</Text>
              <Text style={styles.shopNameText} numberOfLines={1}>{shopName}</Text>
              <Text style={styles.orderDateText}>วันที่สั่ง: {orderDate}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.ratingQuestion}>รสชาติและความพึงพอใจของอาหาร</Text>

          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((starNum) => {
              const isSelected = starNum <= shopRating;
              return (
                <TouchableOpacity
                  key={starNum}
                  style={styles.starCol}
                  onPress={() => setShopRating(starNum)}
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
              value={shopComment}
              onChangeText={setShopComment}
            />
            <MaterialIcons name="edit" size={14} color="#cbd5e1" style={styles.textareaCornerIcon} />
          </View>

          {/* แนบรูปภาพ */}
          <TouchableOpacity 
            style={[styles.addPhotoCard, hasPhoto && styles.addPhotoCardActive]}
            onPress={() => {
              setHasPhoto(!hasPhoto);
              Alert.alert('รูปภาพ', hasPhoto ? 'ยกเลิกการแนบรูปภาพ' : 'เพิ่มรูปภาพอาหารเรียบร้อย');
            }}
            activeOpacity={0.75}
          >
            <MaterialIcons 
              name="add-a-photo" 
              size={24} 
              color="#16a34a" 
            />
            <Text style={styles.addPhotoText}>
              {hasPhoto ? '✓ มีรูปภาพแนบแล้ว (คลิกเพื่อยกเลิก)' : 'แนบรูปภาพอาหารประกอบรีวิว'}
            </Text>
          </TouchableOpacity>
        </View>

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
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderStyle: 'dashed',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  addPhotoCardActive: { backgroundColor: '#f0fdf4', borderColor: '#16a34a' },
  addPhotoText: { fontSize: 12, fontWeight: '600', color: '#16a34a' },

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
