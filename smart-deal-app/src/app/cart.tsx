import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, Image, TouchableOpacity, 
  ScrollView, TextInput, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import axios from 'axios';
import { BASE_URL } from '../constants/api';
import { useCart, parseItemPrice, parseItemStock } from '../context/CartContext';

export default function CartScreen() {
    const { cart, updateQuantity, removeFromCart, clearCart, totalAmount } = useCart();
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(25);
  const [minOrderValue, setMinOrderValue] = useState<number>(50);

  // ดึงการตั้งค่าค่าจัดส่งจากระบบ
  useFocusEffect(
    React.useCallback(() => {
      const fetchSettings = async () => {
        try {
          const res = await axios.get(`${BASE_URL}/settings`);
          if (res.data?.success) {
            if (res.data.base_delivery_fee !== undefined) {
              setDeliveryFee(Number(res.data.base_delivery_fee));
            }
            if (res.data.minimum_order_value !== undefined) {
              setMinOrderValue(Number(res.data.minimum_order_value));
            }
          }
        } catch (e) {
          console.log('Fetch settings in cart error:', e);
        }
      };
      fetchSettings();
    }, [])
  );

  const handleApplyPromo = () => {
    if (!promoCode.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกโค้ดส่วนลด');
      return;
    }
    if (promoCode.trim().toUpperCase() === 'DISCOUNT10' || promoCode.trim().toUpperCase() === 'SMART10') {
      setDiscount(10);
      Alert.alert('สำเร็จ', 'ใช้โค้ดส่วนลด 10 บาทเรียบร้อย');
    } else {
      Alert.alert('แจ้งเตือน', 'โค้ดส่วนลดไม่ถูกต้องหรือหมดอายุ');
    }
  };

  // คำนวณยอดเงินอย่างปลอดภัย (ป้องกัน NaN 100%)
  const safeTotalAmount = isNaN(totalAmount) ? 0 : totalAmount;
  const safeDiscount = isNaN(discount) ? 0 : discount;
  // ค่าจัดส่งดึงตามการตั้งค่าระบบ
  const finalTotal = Math.max(0, safeTotalAmount + deliveryFee - safeDiscount);

  // ตรวจสอบและไปหน้าชำระเงิน
  const handleProceedToCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('แจ้งเตือน', 'ไม่มีสินค้าในตะกร้า');
      return;
    }

    // ตรวจสอบว่ามีสินค้าชิ้นใดเกินสต็อกหรือไม่
    for (const item of cart) {
      const pStock = parseItemStock(item);
      const pQty = Number(item.quantity) || 1;
      const pPrice = parseItemPrice(item);

      if (isNaN(pPrice) || pPrice <= 0) {
        Alert.alert('ผิดพลาด', `ราคาสินค้า "${item.name}" ไม่ถูกต้อง กรุณาลบและเลือกใหม่อีกครั้ง`);
        return;
      }

      if (pQty > pStock) {
        Alert.alert(
          'สต็อกไม่เพียงพอ',
          `สินค้า "${item.name}" ในตะกร้ามี ${pQty} ชิ้น แต่มีในสต็อกเพียง ${pStock} ชิ้น กรุณาปรับลดจำนวนก่อนดำเนินการต่อ`
        );
        return;
      }
    }

    router.push('/checkout');
  };

  // จัดการการลดจำนวนสินค้า (-)
  const handleDecreaseQty = (item: any) => {
    const currentQty = Number(item.quantity) || 1;
    if (currentQty > 1) {
      updateQuantity(item.product_id, currentQty - 1);
    } else {
      Alert.alert(
        'ยืนยันการลบ',
        `ต้องการลบ "${item.name}" ออกจากตะกร้าหรือไม่?`,
        [
          { text: 'ยกเลิก', style: 'cancel' },
          { 
            text: 'ลบสินค้า', 
            style: 'destructive', 
            onPress: () => removeFromCart(item.product_id) 
          }
        ]
      );
    }
  };

  // จัดการการเพิ่มจำนวนสินค้า (+) ล็อกตาม stock_quantity
  const handleIncreaseQty = (item: any) => {
    const currentQty = Number(item.quantity) || 1;
    const maxStock = parseItemStock(item);

    if (currentQty < maxStock) {
      updateQuantity(item.product_id, currentQty + 1);
    } else {
      Alert.alert(
        'ถึงขีดจำกัดสต็อกแล้ว',
        `อาหารส่วนเกิน "${item.name}" มีเหลือเพียง ${maxStock} ชิ้นในระบบ ไม่สามารถสั่งเพิ่มได้มากกว่านี้`
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.circleBtn} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={22} color="#16a34a" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>ตะกร้าของฉัน</Text>

        {cart.length > 0 ? (
          <TouchableOpacity 
            style={styles.circleBtn}
            onPress={() => Alert.alert('ยืนยัน', 'ต้องการลบสินค้าทั้งหมดในตะกร้าหรือไม่?', [
              { text: 'ยกเลิก', style: 'cancel' },
              { text: 'ลบทั้งหมด', onPress: clearCart, style: 'destructive' }
            ])}
            activeOpacity={0.7}
          >
            <MaterialIcons name="delete-outline" size={22} color="#ef4444" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Cart Content */}
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {cart.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <MaterialIcons name="remove-shopping-cart" size={48} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>ไม่มีสินค้าในตะกร้าของคุณ</Text>
            <Text style={styles.emptySubTitle}>เลือกซื้ออาหารส่วนเกินและดีลลดราคาสุดคุ้มได้ที่หน้าแรก</Text>
            <TouchableOpacity 
              style={styles.exploreBtn} 
              onPress={() => router.push('/(tabs)')}
              activeOpacity={0.85}
            >
              <Text style={styles.exploreBtnText}>เลือกดูดีลอาหารสด</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* List Items */}
            {cart.map((item) => {
              const safePrice = parseItemPrice(item);
              const safeStock = parseItemStock(item);
              const currentQty = Number(item.quantity) || 1;
              const isAtMaxStock = currentQty >= safeStock;

              return (
                <View key={item.product_id} style={styles.cartCard}>
                  <Image 
                    source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500' }} 
                    style={styles.itemImage} 
                  />
                  <View style={styles.itemInfo}>
                    <View style={styles.itemHeaderRow}>
                      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                      <TouchableOpacity 
                        onPress={() => removeFromCart(item.product_id)}
                        style={styles.deleteItemBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialIcons name="close" size={18} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>

                    {/* Stock badge indicator */}
                    <View style={styles.stockIndicatorRow}>
                      {safeStock <= 3 ? (
                        <View style={styles.lowStockBadge}>
                          <MaterialIcons name="local-fire-department" size={11} color="#ea580c" />
                          <Text style={styles.lowStockBadgeText}>เหลือ {safeStock} ชิ้นสุดท้าย</Text>
                        </View>
                      ) : (
                        <View style={styles.normalStockBadge}>
                          <MaterialIcons name="inventory-2" size={11} color="#16a34a" />
                          <Text style={styles.normalStockBadgeText}>คงเหลือ {safeStock} ชิ้น</Text>
                        </View>
                      )}
                    </View>

                    {/* Price and Stepper Row */}
                    <View style={styles.priceAndQtyRow}>
                      <View>
                        <Text style={styles.itemPrice}>
                          ฿{safePrice.toFixed(2)}
                        </Text>
                        {item.original_price && item.original_price > safePrice ? (
                          <Text style={styles.itemOldPrice}>฿{Number(item.original_price).toFixed(2)}</Text>
                        ) : null}
                      </View>

                      {/* Qty Stepper */}
                      <View style={styles.qtyBox}>
                        <TouchableOpacity 
                          onPress={() => handleDecreaseQty(item)}
                          style={styles.qtyBtn}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons 
                            name={currentQty === 1 ? "delete-outline" : "remove"} 
                            size={16} 
                            color={currentQty === 1 ? "#ef4444" : "#16a34a"} 
                          />
                        </TouchableOpacity>

                        <Text style={styles.qtyText}>{currentQty}</Text>

                        <TouchableOpacity 
                          onPress={() => handleIncreaseQty(item)}
                          style={[styles.qtyBtn, isAtMaxStock && styles.qtyBtnDisabled]}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons 
                            name="add" 
                            size={16} 
                            color={isAtMaxStock ? "#cbd5e1" : "#16a34a"} 
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Promo Code Box */}
            <View style={styles.promoBox}>
              <MaterialIcons name="local-offer" size={20} color="#16a34a" />
              <TextInput
                style={styles.promoInput}
                placeholder="ใส่รหัสส่วนลด (เช่น DISCOUNT10)"
                placeholderTextColor="#94a3b8"
                value={promoCode}
                onChangeText={setPromoCode}
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.promoBtn} onPress={handleApplyPromo} activeOpacity={0.8}>
                <Text style={styles.promoBtnText}>ใช้สิทธิ์</Text>
              </TouchableOpacity>
            </View>

            {/* Order Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>สรุปยอดชำระ</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>รวมรายการอาหาร</Text>
                <Text style={styles.summaryValue}>฿{safeTotalAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>ค่าจัดส่ง</Text>
                <Text style={styles.summaryValue}>฿{deliveryFee.toFixed(2)}</Text>
              </View>
              {safeDiscount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>ส่วนลดโปรโมชั่น</Text>
                  <Text style={[styles.summaryValue, { color: '#ef4444' }]}>-฿{safeDiscount.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>ยอดรวมสุทธิ</Text>
                <Text style={styles.totalValue}>฿{finalTotal.toFixed(2)}</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom Action Button */}
      {cart.length > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity 
            style={styles.checkoutBtn} 
            onPress={handleProceedToCheckout}
            activeOpacity={0.85}
          >
            <Text style={styles.checkoutText}>
              ไปหน้าชำระเงิน • ฿{finalTotal.toFixed(2)}
            </Text>
            <MaterialIcons name="chevron-right" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9' 
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#0f172a' },
  scrollContent: { padding: 16, paddingBottom: 110 },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 24 },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  emptyTitle: { fontSize: 17, fontWeight: 'bold', color: '#0f172a', marginBottom: 6 },
  emptySubTitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 24 },
  exploreBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24
  },
  exploreBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  cartCard: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    padding: 14, 
    borderRadius: 20, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#f1f5f9',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6
  },
  itemImage: { width: 76, height: 76, borderRadius: 14, backgroundColor: '#f1f5f9' },
  itemInfo: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
  itemHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemName: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', flex: 1, marginRight: 6 },
  deleteItemBtn: { padding: 2 },
  
  stockIndicatorRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  lowStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4
  },
  lowStockBadgeText: { fontSize: 10, color: '#ea580c', fontWeight: 'bold' },
  normalStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4
  },
  normalStockBadgeText: { fontSize: 10, color: '#16a34a', fontWeight: 'bold' },

  priceAndQtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 },
  itemPrice: { fontSize: 15, fontWeight: 'bold', color: '#16a34a' },
  itemOldPrice: { fontSize: 11, color: '#94a3b8', textDecorationLine: 'line-through' },

  qtyBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f8fafc', 
    borderRadius: 14, 
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 4, 
    paddingVertical: 2 
  },
  qtyBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  qtyBtnDisabled: { opacity: 0.3 },
  qtyText: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', paddingHorizontal: 8 },

  promoBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderRadius: 16, 
    marginTop: 8, 
    borderWidth: 1, 
    borderColor: '#cbd5e1', 
    borderStyle: 'dashed' 
  },
  promoInput: { flex: 1, marginLeft: 8, fontSize: 13, color: '#0f172a' },
  promoBtn: { backgroundColor: '#e8f5e9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  promoBtnText: { color: '#16a34a', fontWeight: 'bold', fontSize: 12 },

  summaryCard: { 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 20, 
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  summaryTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: '#64748b' },
  summaryValue: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 10 },
  totalLabel: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  totalValue: { fontSize: 19, fontWeight: 'bold', color: '#16a34a' },

  bottomBar: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: '#fff', 
    paddingHorizontal: 20, 
    paddingVertical: 14, 
    borderTopWidth: 1, 
    borderTopColor: '#f1f5f9' 
  },
  checkoutBtn: { 
    backgroundColor: '#2e7a32', 
    borderRadius: 24, 
    paddingVertical: 14, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    gap: 4
  },
  checkoutText: { color: '#fff', fontSize: 15, fontWeight: 'bold' }
});