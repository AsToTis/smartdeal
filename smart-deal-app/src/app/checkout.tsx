import React, { useState, useCallback, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  Image, ActivityIndicator, Alert, TextInput, Modal, Pressable 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { useCart, parseItemPrice } from '../context/CartContext';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants/api';

export default function CheckoutScreen() {
  const params = useLocalSearchParams();
  const cartContext = useCart() as any;

  // 1. ตรวจสอบว่ามี buyNowData ส่งมาจากหน้า product-detail หรือไม่
  let buyNowItems: any[] | null = null;
  if (params.buyNowData) {
    try {
      buyNowItems = JSON.parse(params.buyNowData as string);
    } catch (e) {
      console.error('Failed to parse buyNowData', e);
    }
  }

  // ถ้าเป็นการ "ซื้อทันที" ให้ใช้ buyNowItems หากไม่มีให้ใช้สินค้าจาก Cart Context ตามปกติ
  const cartItems: any[] = buyNowItems || 
    cartContext?.cartItems || 
    cartContext?.cart || 
    cartContext?.items || [];

  const clearCart = cartContext?.clearCart;

  const [loading, setLoading] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<'promptpay' | 'credit'>('promptpay');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [address, setAddress] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<number>(2);

  // Coupons State
  const [coupons, setCoupons] = useState<any[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<any | null>(null);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [loadingCoupons, setLoadingCoupons] = useState(false);

  // ดึงข้อมูลที่อยู่และคูปองจริงเมื่อเปิดหน้า
  useFocusEffect(
    useCallback(() => {
      fetchUserAddressAndCoupons();
    }, [])
  );

  const fetchUserAddressAndCoupons = async () => {
    try {
      setLoadingAddress(true);
      let userId = 2;
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const u = JSON.parse(userData);
          if (u?.user_id) {
            userId = u.user_id;
            setCurrentUserId(u.user_id);
          }
        }
      } catch (e) {}

      // ดึงที่อยู่
      try {
        const res = await axios.get(`${BASE_URL}/users/${userId}/address`);
        if (res.data && (res.data.title || res.data.address_detail)) {
          setAddress(res.data);
          if (res.data.note_for_rider && !deliveryNote) {
            setDeliveryNote(res.data.note_for_rider);
          }
        } else {
          setAddress(null);
        }
      } catch (e) {
        setAddress(null);
      }

      // ดึงคูปองสะสมของผู้ใช้
      await loadUserCoupons(userId);
    } catch (error) {
      console.log('Error initializing checkout data:', error);
    } finally {
      setLoadingAddress(false);
    }
  };

  const loadUserCoupons = async (userId: number) => {
    try {
      setLoadingCoupons(true);
      let combinedCoupons: any[] = [];

      // 1. ดึงจาก Server / DB
      try {
        const res = await axios.get(`${BASE_URL}/coupons/${userId}`);
        if (res.data && res.data.success && Array.isArray(res.data.coupons)) {
          combinedCoupons = [...res.data.coupons];
        }
      } catch (err) {
        console.log('Error fetching coupons from backend:', err);
      }

      // 2. ดึงจาก AsyncStorage สำรอง
      try {
        const saved = await AsyncStorage.getItem('savedCoupons');
        if (saved) {
          const localCoupons = JSON.parse(saved);
          if (Array.isArray(localCoupons)) {
            for (const lc of localCoupons) {
              if (!combinedCoupons.some(c => c.code === lc.code)) {
                combinedCoupons.push(lc);
              }
            }
          }
        }
      } catch (err) {}

      setCoupons(combinedCoupons);
    } catch (e) {
      console.log('Error loading coupons:', e);
    } finally {
      setLoadingCoupons(false);
    }
  };

  // 2. คำนวณราคาจริง (ปลอดภัยจาก NaN)
  const subtotal = cartItems.reduce((sum: number, item: any) => {
    const price = parseItemPrice(item);
    const qty = Number(item?.quantity ?? item?.qty ?? 1) || 1;
    const lineTotal = price * qty;
    return sum + (isNaN(lineTotal) ? 0 : lineTotal);
  }, 0);

  // โครงสร้างค่าจัดส่งตาม System Control Panel (เริ่มต้น ฿35 + ฿8/กม. ระยะทางประมาณ 2.5 กม. = ฿55.00)
  const baseDeliveryFare = 35;
  const perKmFare = 8;
  const estimatedDistanceKm = 2.5;
  const calculatedDeliveryFare = Math.round(baseDeliveryFare + (estimatedDistanceKm * perKmFare));
  const deliveryFee = deliveryMethod === 'delivery' ? calculatedDeliveryFare : 0;

  // คำนวณส่วนลดตามคูปองที่เลือก
  let discount = 0;
  if (selectedCoupon) {
    if (selectedCoupon.type === 'free_delivery') {
      discount = deliveryFee;
    } else if (selectedCoupon.type === 'discount') {
      discount = Math.min(Number(selectedCoupon.value || 0), subtotal);
    } else if (selectedCoupon.type === 'percent') {
      discount = Math.min((subtotal * Number(selectedCoupon.value || 0)) / 100, subtotal);
    } else {
      discount = Math.min(Number(selectedCoupon.value || 0), subtotal);
    }
  }

  const grandTotal = Math.max(0, subtotal + deliveryFee - discount);
  const deliveryFeeText = deliveryMethod === 'delivery' ? `฿${deliveryFee.toFixed(2)}` : 'ฟรี (รับเองที่ร้าน)';

  const handleApplyCustomCode = () => {
    const trimmed = couponCodeInput.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกโค้ดส่วนลด');
      return;
    }

    // ตรวจสอบในคูปองที่มี
    const matched = coupons.find(c => c.code?.toUpperCase() === trimmed);
    if (matched) {
      setSelectedCoupon(matched);
      setShowCouponModal(false);
      setCouponCodeInput('');
      Alert.alert('สำเร็จ 🎉', `ใช้คูปอง "${matched.title}" เรียบร้อยแล้ว`);
      return;
    }

    // โค้ดมาตรฐานของระบบ
    if (trimmed === 'DISCOUNT50') {
      setSelectedCoupon({ code: 'DISCOUNT50', title: 'ส่วนลด 50 บาท', type: 'discount', value: 50 });
      setShowCouponModal(false);
      setCouponCodeInput('');
      Alert.alert('สำเร็จ 🎉', 'ใช้โค้ดส่วนลด 50 บาท เรียบร้อยแล้ว');
    } else if (trimmed === 'FREEDEL') {
      setSelectedCoupon({ code: 'FREEDEL', title: 'คูปองส่งฟรี', type: 'free_delivery', value: 15 });
      setShowCouponModal(false);
      setCouponCodeInput('');
      Alert.alert('สำเร็จ 🎉', 'ใช้คูปองส่งฟรีเรียบร้อยแล้ว');
    } else {
      Alert.alert('ไม่พบคูปอง', 'โค้ดส่วนลดไม่ถูกต้อง หรือยังไม่ได้แลกรับคูปองนี้');
    }
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      Alert.alert('แจ้งเตือน', 'ไม่มีสินค้าในรายการสั่งซื้อ');
      return;
    }

    try {
      setLoading(true);

      const orderPayload = {
        user_id: currentUserId || 2,
        shop_id: cartItems[0]?.shop_id || 1,
        subtotal: subtotal,
        delivery_fee: deliveryFee,
        discount: discount,
        total_amount: grandTotal,
        order_status: 'pending',
        delivery_type: deliveryMethod,
        payment_method: paymentMethod,
        coupon_id: selectedCoupon?.id || null,
        coupon_code: selectedCoupon?.code || null,
        receiver_name: address?.receiver_name || 'ผู้รับ',
        receiver_phone: address?.receiver_phone || '',
        shipping_address: address ? `${address.title || ''} ${address.address_detail || ''}` : 'ไม่ระบุที่อยู่',
        latitude: address?.latitude || 0,
        longitude: address?.longitude || 0,
        note_for_rider: deliveryNote,
        items: cartItems.map((item: any) => ({
          product_id: item.id || item.product_id,
          product_name: item.name || item.product_name,
          price: parseItemPrice(item),
          quantity: Number(item?.quantity ?? item?.qty ?? 1) || 1,
          shop_id: item.shop_id || 1
        }))
      };

      const res = await axios.post(`${BASE_URL}/orders`, orderPayload);

      if (res.status === 200 || res.status === 201) {
        const createdOrderId = res.data?.order_id || res.data?.id || res.data?.insertId || 1;
        const currentShopId = cartItems[0]?.shop_id || 1;

        // ลบคูปองที่ใช้แล้วออกจาก local storage
        if (selectedCoupon?.code) {
          try {
            const saved = await AsyncStorage.getItem('savedCoupons');
            if (saved) {
              const localCoupons = JSON.parse(saved);
              const updated = localCoupons.filter((c: any) => c.code !== selectedCoupon.code);
              await AsyncStorage.setItem('savedCoupons', JSON.stringify(updated));
            }
          } catch (e) {}
        }

        // เปลี่ยนเส้นทางไปยังหน้า Payment
        router.replace({
          pathname: '/payment',
          params: {
            order_id: createdOrderId,
            amount: grandTotal,
            shop_id: currentShopId
          }
        } as any);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data || error.message;
      console.log('Order Error Details:', errorMessage);
      Alert.alert('แจ้งเตือนการสั่งซื้อ', typeof errorMessage === 'string' ? errorMessage : 'เกิดข้อผิดพลาดในการสั่งซื้อ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ชำระเงิน / ตัวเลือกการส่ง</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* ที่อยู่จัดส่ง */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ที่อยู่จัดส่ง</Text>
            <TouchableOpacity onPress={() => router.push('/address' as any)}>
              <Text style={styles.editBtnText}>แก้ไข</Text>
            </TouchableOpacity>
          </View>

          {loadingAddress ? (
            <ActivityIndicator color="#2e7a32" style={{ marginVertical: 10 }} />
          ) : (
            <TouchableOpacity 
              style={styles.addressCard}
              onPress={() => router.push('/address' as any)}
            >
              <View style={styles.locIconBg}>
                <MaterialIcons name="location-on" size={24} color="#2e7a32" />
              </View>
              <View style={styles.addressInfo}>
                <Text style={styles.addressTitle}>{address?.title || 'ยังไม่มีที่อยู่จัดส่ง'}</Text>
                <Text style={styles.addressDetail}>{address?.address_detail || 'กรุณาแตะเพื่อเลือกหรือเพิ่มที่อยู่'}</Text>
                {address?.receiver_name && (
                  <Text style={styles.receiverText}>ผู้รับ: {address.receiver_name} ({address.receiver_phone})</Text>
                )}
              </View>
              <MaterialIcons name="chevron-right" size={22} color="#aaa" />
            </TouchableOpacity>
          )}

          <TextInput
            style={styles.noteInput}
            placeholder="หมายเหตุถึงไรเดอร์ (เช่น ฝากไว้ที่นิติ, วางไว้หน้าประตู)"
            value={deliveryNote}
            onChangeText={setDeliveryNote}
          />
        </View>

        {/* วิธีการรับสินค้า */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>วิธีการรับสินค้า</Text>
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tabBtn, deliveryMethod === 'delivery' && styles.tabBtnActive]} 
              onPress={() => setDeliveryMethod('delivery')}
            >
              <MaterialIcons name="local-shipping" size={18} color={deliveryMethod === 'delivery' ? '#2e7a32' : '#666'} />
              <Text style={[styles.tabText, deliveryMethod === 'delivery' && styles.tabTextActive]}>เดลิเวอรี่</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabBtn, deliveryMethod === 'pickup' && styles.tabBtnActive]} 
              onPress={() => setDeliveryMethod('pickup')}
            >
              <MaterialIcons name="storefront" size={18} color={deliveryMethod === 'pickup' ? '#2e7a32' : '#666'} />
              <Text style={[styles.tabText, deliveryMethod === 'pickup' && styles.tabTextActive]}>รับที่ร้านเอง</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* คูปองส่วนลด / แลกของรางวัล */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="local-offer" size={18} color="#e11d48" />
              <Text style={styles.sectionTitle}>คูปองส่วนลด / พอยท์</Text>
            </View>
            <TouchableOpacity onPress={() => setShowCouponModal(true)}>
              <Text style={styles.editBtnText}>
                {selectedCoupon ? 'เปลี่ยนคูปอง' : 'เลือกคูปอง'}
              </Text>
            </TouchableOpacity>
          </View>

          {selectedCoupon ? (
            <View style={styles.activeCouponCard}>
              <View style={styles.activeCouponLeft}>
                <View style={styles.couponIconCircle}>
                  <MaterialIcons 
                    name={selectedCoupon.type === 'free_delivery' ? 'local-shipping' : 'discount'} 
                    size={20} 
                    color="#e11d48" 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeCouponTitle}>{selectedCoupon.title || selectedCoupon.code}</Text>
                  <Text style={styles.activeCouponSub}>
                    {selectedCoupon.type === 'free_delivery' 
                      ? 'ส่งฟรี (ลดค่าส่ง ฿15)' 
                      : `ลดทันที ฿${selectedCoupon.value || 50}`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.removeCouponBtn}
                onPress={() => setSelectedCoupon(null)}
              >
                <MaterialIcons name="close" size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.selectCouponBtn}
              onPress={() => setShowCouponModal(true)}
            >
              <MaterialIcons name="confirmation-number" size={20} color="#64748b" />
              <Text style={styles.selectCouponBtnText}>
                {coupons.length > 0 ? `มีคูปองใช้ได้ ${coupons.length} ใบ แตะเพื่อเลือก` : 'ใส่โค้ดส่วนลด หรือเลือกคูปอง'}
              </Text>
              <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* วิธีการชำระเงิน */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>วิธีการชำระเงิน</Text>
          
          <TouchableOpacity 
            style={[styles.paymentCard, paymentMethod === 'promptpay' && styles.paymentCardActive]}
            onPress={() => setPaymentMethod('promptpay')}
          >
            <View style={styles.paymentLeft}>
              <MaterialIcons name="qr-code-scanner" size={24} color="#2e7a32" />
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.paymentTitle}>สแกน QR PromptPay</Text>
                  <View style={styles.recomTag}><Text style={styles.recomText}>แนะนำ</Text></View>
                </View>
                <Text style={styles.paymentSub}>ปลอดภัยสูง สแกนจ่ายได้ทันที</Text>
              </View>
            </View>
            <MaterialIcons 
              name={paymentMethod === 'promptpay' ? 'radio-button-checked' : 'radio-button-unchecked'} 
              size={20} 
              color="#2e7a32" 
            />
          </TouchableOpacity>

          <Text style={styles.securityText}>🔒 ความปลอดภัยสูงสุดผ่านระบบ SSL Encrypted</Text>
        </View>

        {/* สรุปรายการคำสั่งซื้อ */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Text style={styles.sectionTitle}>สรุปรายการคำสั่งซื้อ</Text>
            <View style={styles.smartDealTag}><Text style={styles.smartDealText}>Smart Deal ✨</Text></View>
          </View>

          {cartItems.length === 0 ? (
            <Text style={{ color: '#888', marginVertical: 10, textAlign: 'center' }}>ไม่มีสินค้าในรายการ</Text>
          ) : (
            cartItems.map((item: any, index: number) => {
              const itemPrice = Number(item?.price ?? item?.discount_price ?? 0);
              const itemOriginalPrice = item?.originalPrice || item?.original_price;
              const itemQty = Number(item?.quantity ?? item?.qty ?? 1);
              const itemImg = item?.image || item?.image_url || item?.product_image;
              const itemName = item?.name || item?.product_name || 'สินค้า';

              return (
                <View key={item.id || item.product_id || index} style={styles.itemCard}>
                  {itemImg ? (
                    <Image source={{ uri: itemImg }} style={styles.itemImg} />
                  ) : (
                    <View style={[styles.itemImg, { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' }]}>
                      <MaterialIcons name="fastfood" size={24} color="#ccc" />
                    </View>
                  )}
                  <View style={styles.itemDetail}>
                    <Text style={styles.itemName} numberOfLines={1}>{itemName}</Text>
                    <Text style={styles.itemShop}>{item.shop_name || 'ร้านค้า'}</Text>
                    <View style={styles.itemPriceRow}>
                      <Text style={styles.itemPrice}>฿{itemPrice.toFixed(2)}</Text>
                      {itemOriginalPrice && <Text style={styles.itemOldPrice}>฿{Number(itemOriginalPrice).toFixed(2)}</Text>}
                      <Text style={styles.itemQty}>x{itemQty}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}

          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>ยอดรวมสินค้า</Text>
              <Text style={styles.summaryVal}>฿{subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>ค่าจัดส่ง</Text>
              <Text style={styles.summaryVal}>{deliveryFeeText}</Text>
            </View>
            {discount > 0 && (
              <View style={styles.summaryRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MaterialIcons name="local-offer" size={14} color="#e11d48" />
                  <Text style={[styles.summaryLabel, { color: '#e11d48', fontWeight: 'bold' }]}>ส่วนลดคูปอง</Text>
                </View>
                <Text style={[styles.summaryVal, { color: '#e11d48', fontWeight: 'bold' }]}>-฿{discount.toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>ยอดชำระเงินสุทธิ</Text>
              <Text style={styles.totalVal}>฿{grandTotal.toFixed(2)}</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* Modal เลือกคูปอง */}
      <Modal
        visible={showCouponModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCouponModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>เลือกคูปองส่วนลด 🎟️</Text>
              <TouchableOpacity onPress={() => setShowCouponModal(false)}>
                <MaterialIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Input โค้ดส่วนลด */}
            <View style={styles.codeInputContainer}>
              <TextInput
                style={styles.couponInput}
                placeholder="กรอกโค้ดส่วนลด (เช่น DISCOUNT50)"
                value={couponCodeInput}
                onChangeText={setCouponCodeInput}
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.applyBtn} onPress={handleApplyCustomCode}>
                <Text style={styles.applyBtnText}>ใช้โค้ด</Text>
              </TouchableOpacity>
            </View>

            {/* รายการคูปองที่แลกไว้ */}
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 10 }}>
              คูปองของฉัน ({coupons.length})
            </Text>

            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {coupons.length > 0 ? (
                coupons.map((coupon, idx) => {
                  const isSelected = selectedCoupon?.code === coupon.code || (selectedCoupon?.id && selectedCoupon.id === coupon.id);
                  return (
                    <TouchableOpacity
                      key={coupon.id || idx}
                      style={[styles.couponItemCard, isSelected && styles.couponItemCardActive]}
                      onPress={() => {
                        setSelectedCoupon(coupon);
                        setShowCouponModal(false);
                      }}
                    >
                      <View style={[styles.couponItemIcon, { backgroundColor: coupon.type === 'free_delivery' ? '#eff6ff' : '#fff1f2' }]}>
                        <MaterialIcons 
                          name={coupon.type === 'free_delivery' ? 'local-shipping' : 'local-offer'} 
                          size={24} 
                          color={coupon.type === 'free_delivery' ? '#2563eb' : '#e11d48'} 
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.couponItemTitle}>{coupon.title || coupon.code}</Text>
                        <Text style={styles.couponItemSub}>
                          {coupon.type === 'free_delivery' 
                            ? 'โค้ดส่งฟรี สำหรับการจัดส่งเดลิเวอรี่' 
                            : `ส่วนลด ฿${coupon.value || 50} สำหรับทุกคำสั่งซื้อ`}
                        </Text>
                        <Text style={styles.couponItemCode}>รหัส: {coupon.code}</Text>
                      </View>
                      <MaterialIcons 
                        name={isSelected ? 'check-circle' : 'radio-button-unchecked'} 
                        size={22} 
                        color={isSelected ? '#16a34a' : '#cbd5e1'} 
                      />
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                  <MaterialIcons name="sentiment-dissatisfied" size={40} color="#cbd5e1" />
                  <Text style={{ color: '#94a3b8', marginTop: 8, fontSize: 13 }}>คุณยังไม่มีคูปองที่แลกไว้</Text>
                  <Text style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>
                    สามารถใช้พอยท์แลกคูปองได้ที่หน้า "โปรไฟล์"
                  </Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity 
              style={styles.closeModalBtn}
              onPress={() => setShowCouponModal(false)}
            >
              <Text style={styles.closeModalBtnText}>ตกลง</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ปุ่มสั่งซื้อด้านล่าง */}
      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={styles.submitBtn} 
          onPress={handlePlaceOrder}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.btnContent}>
              <MaterialIcons name="lock" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>
                สั่งซื้อและชำระเงิน ฿{grandTotal.toFixed(2)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8f6' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#eee'
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  scrollContent: { padding: 16, paddingBottom: 110 },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#111' },
  editBtnText: { fontSize: 13, color: '#2e7a32', fontWeight: '600' },

  addressCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    padding: 14, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#e2e8f0' 
  },
  locIconBg: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center' },
  addressInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  addressTitle: { fontSize: 14, fontWeight: 'bold', color: '#111' },
  addressDetail: { fontSize: 12, color: '#666', marginTop: 2, lineHeight: 16 },
  receiverText: { fontSize: 11, color: '#888', marginTop: 4 },
  noteInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    marginTop: 8,
    color: '#333'
  },

  tabContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    borderRadius: 14, 
    padding: 4, 
    borderWidth: 1, 
    borderColor: '#e2e8f0',
    marginTop: 8
  },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabBtnActive: { backgroundColor: '#e8f5e9' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#666' },
  tabTextActive: { color: '#2e7a32', fontWeight: 'bold' },

  // Coupons UI
  selectCouponBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4
  },
  selectCouponBtnText: { flex: 1, marginLeft: 10, fontSize: 13, color: '#475569' },
  activeCouponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff1f2',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#fecdd3',
    marginTop: 4
  },
  activeCouponLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  couponIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffe4e6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  activeCouponTitle: { fontSize: 13, fontWeight: 'bold', color: '#9f1239' },
  activeCouponSub: { fontSize: 11, color: '#e11d48', marginTop: 2 },
  removeCouponBtn: { padding: 6 },

  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f7f1',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2e7a32',
    marginTop: 8
  },
  paymentCardActive: { backgroundColor: '#e8f5e9' },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paymentTitle: { fontSize: 13, fontWeight: 'bold', color: '#111' },
  paymentSub: { fontSize: 11, color: '#666', marginTop: 2 },
  recomTag: { backgroundColor: '#4f46e5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  recomText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  securityText: { fontSize: 11, color: '#888', marginTop: 8, textAlign: 'center' },

  smartDealTag: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  smartDealText: { color: '#15803d', fontSize: 10, fontWeight: 'bold' },
  
  itemCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 10, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  itemImg: { width: 60, height: 60, borderRadius: 8 },
  itemDetail: { flex: 1, marginLeft: 10, justifyContent: 'space-around' },
  itemName: { fontSize: 13, fontWeight: 'bold', color: '#222' },
  itemShop: { fontSize: 11, color: '#777' },
  itemPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemPrice: { fontSize: 13, fontWeight: 'bold', color: '#2e7a32' },
  itemOldPrice: { fontSize: 10, color: '#aaa', textDecorationLine: 'line-through' },
  itemQty: { marginLeft: 'auto', fontSize: 12, color: '#666' },

  summaryBox: { backgroundColor: '#fff', padding: 14, borderRadius: 14, marginTop: 8, borderWidth: 1, borderColor: '#eee' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 12, color: '#666' },
  summaryVal: { fontSize: 12, fontWeight: '600', color: '#222' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  totalLabel: { fontSize: 14, fontWeight: 'bold', color: '#111' },
  totalVal: { fontSize: 18, fontWeight: 'bold', color: '#2e7a32' },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#eee',
    elevation: 10
  },
  submitBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  // Coupon Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#0f172a' },
  codeInputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  couponInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a'
  },
  applyBtn: {
    backgroundColor: '#2e7a32',
    paddingHorizontal: 18,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  applyBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  couponItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0'
  },
  couponItemCardActive: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4'
  },
  couponItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  couponItemTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  couponItemSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  couponItemCode: { fontSize: 10, color: '#94a3b8', marginTop: 4, fontWeight: '600' },
  closeModalBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14
  },
  closeModalBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' }
});
