import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, Image, TouchableOpacity, 
  ScrollView, Alert, ActivityIndicator, Share 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { BASE_URL } from '../constants/api';
import { useCart } from '../context/CartContext';

export default function ProductDetailScreen() {
  const params = useLocalSearchParams();
  const id = params.id;
  const { addToCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  
  // จำนวนที่เลือกสั่งซื้อ
  const [quantity, setQuantity] = useState<number>(1);

  // เวลาถอยหลัง (ชม. : นาที : วินาที)
  const [timeLeft, setTimeLeft] = useState({
    hours: '00',
    minutes: '00',
    seconds: '00'
  });

  useEffect(() => {
    if (id) {
      fetchProductDetail();
    }
  }, [id]);

  const fetchProductDetail = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BASE_URL}/products/${id}`);
      if (res.data.success && res.data.product) {
        const prod = res.data.product;
        setProduct(prod);
        // ถ้าสินค้าหมด ให้ quantity เป็น 0
        const stock = parseInt(prod.stock_quantity !== undefined && prod.stock_quantity !== null ? prod.stock_quantity : 0, 10);
        setQuantity(stock > 0 ? 1 : 0);
      }
    } catch (error) {
      console.error('Failed to load product detail:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถโหลดข้อมูลสินค้าจากฐานข้อมูลได้');
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  const parseSafeDate = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).trim();
    const isoStr = str.includes('T') ? str : str.replace(' ', 'T');
    const d = new Date(isoStr).getTime();
    if (!isNaN(d)) return d;
    const d2 = new Date(str).getTime();
    if (!isNaN(d2)) return d2;
    return 0;
  };

  // นับเวลาถอยหลัง Real-time
  useEffect(() => {
    const rawEnd = product?.deal_end_time || product?.expiry_time;
    if (!rawEnd) {
      setTimeLeft({ hours: '00', minutes: '00', seconds: '00' });
      return;
    }

    const calculateTime = () => {
      const now = new Date().getTime();
      const endTime = parseSafeDate(rawEnd);

      if (endTime <= 0) {
        setTimeLeft({ hours: '00', minutes: '00', seconds: '00' });
        return;
      }

      const diff = endTime - now;

      if (diff > 0) {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeLeft({
          hours: isNaN(h) ? '00' : (h < 10 ? `0${h}` : `${h}`),
          minutes: isNaN(m) ? '00' : (m < 10 ? `0${m}` : `${m}`),
          seconds: isNaN(s) ? '00' : (s < 10 ? `0${s}` : `${s}`),
        });
      } else {
        setTimeLeft({ hours: '00', minutes: '00', seconds: '00' });
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [product]);

  const stock = parseInt(product?.stock_quantity !== undefined && product?.stock_quantity !== null ? product.stock_quantity : 0, 10);
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= 3;

  const handleDecreaseQty = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const handleIncreaseQty = () => {
    if (quantity < stock) {
      setQuantity(prev => prev + 1);
    } else {
      Alert.alert('แจ้งเตือน', `สินค้ามีเหลือเพียง ${stock} ชิ้น ไม่สามารถเพิ่มจำนวนได้มากกว่านี้`);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `ดีลพิเศษลดราคา: ${product?.name || 'อาหารลดราคา'} ประหยัดสูงสุด ${product?.discount_percent || 30}% บน Smart Deal!`,
      });
    } catch (e) {}
  };

  const handleBuyNow = () => {
    if (!product || isOutOfStock) {
      Alert.alert('แจ้งเตือน', 'สินค้านี้หมดแล้ว ไม่สามารถสั่งซื้อได้');
      return;
    }

    const singleItem = {
      product_id: product.product_id || product.id,
      product_name: product.name,
      name: product.name,
      price: Number(product.discount_price || product.original_price || 0),
      quantity: quantity,
      shop_id: product.shop_id || 1,
      image_url: product.image_url
    };

    router.push({
      pathname: '/checkout',
      params: {
        buyNowData: JSON.stringify([singleItem])
      }
    } as any);
  };

  const handleAddToCart = () => {
    if (!product || isOutOfStock) {
      Alert.alert('แจ้งเตือน', 'สินค้านี้หมดแล้ว');
      return;
    }

    addToCart({
      product_id: product.product_id || product.id,
      product_name: product.name,
      name: product.name,
      price: Number(product.discount_price || product.original_price || 0),
      quantity: quantity,
      stock_quantity: product.stock_quantity,
      shop_id: product.shop_id || 1,
      image_url: product.image_url
    }, quantity);

    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
    Alert.alert('สำเร็จ', `เพิ่ม "${product.name}" จำนวน ${quantity} ชิ้นลงตะกร้าแล้ว`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={{ marginTop: 10, color: '#64748b' }}>กำลังโหลดรายละเอียดสินค้าจากฐานข้อมูล...</Text>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="alert-circle-outline" size={54} color="#94a3b8" />
        <Text style={{ marginTop: 14, fontSize: 16, fontWeight: 'bold', color: '#0f172a' }}>
          ไม่พบข้อมูลสินค้านี้ในฐานข้อมูล
        </Text>
        <Text style={{ marginTop: 6, fontSize: 13, color: '#64748b', textAlign: 'center', marginHorizontal: 32 }}>
          สินค้านี้อาจถูกจำหน่ายหมด หรือนำออกจากระบบแล้ว
        </Text>
        <TouchableOpacity
          style={{ marginTop: 20, backgroundColor: '#16a34a', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 14 }}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>กลับหน้ารายการสินค้า</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.circleBtn} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={22} color="#16a34a" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>รายละเอียดสินค้า</Text>

        <TouchableOpacity 
          style={styles.circleBtn} 
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Ionicons name="share-social-outline" size={20} color="#16a34a" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        {/* 2. การ์ดภาพสินค้า + กล่องนับเวลาถอยหลังด้านใน */}
        <View style={styles.imageCardContainer}>
          <Image 
            source={{ uri: product?.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800' }} 
            style={[styles.productImage, isOutOfStock && styles.productImageDisabled]} 
          />

          {isOutOfStock && (
            <View style={styles.soldOutBanner}>
              <Text style={styles.soldOutBannerText}>สินค้าหมดชั่วคราว (SOLD OUT)</Text>
            </View>
          )}

          {/* Floating Deal Countdown Overlay */}
          <View style={styles.countdownBox}>
            <View style={styles.countdownLeft}>
              <MaterialIcons name="access-time" size={18} color="#16a34a" />
              <Text style={styles.countdownLabel}>เวลาดีลคงเหลือ:</Text>
            </View>

            <View style={styles.timerGroup}>
              <View style={styles.timeDigitBox}>
                <Text style={styles.timeDigit}>{timeLeft.hours}</Text>
                <Text style={styles.timeUnit}>ชม.</Text>
              </View>
              <Text style={styles.colon}>:</Text>
              <View style={styles.timeDigitBox}>
                <Text style={styles.timeDigit}>{timeLeft.minutes}</Text>
                <Text style={styles.timeUnit}>นาที</Text>
              </View>
              <Text style={styles.colon}>:</Text>
              <View style={styles.timeDigitBox}>
                <Text style={styles.timeDigit}>{timeLeft.seconds}</Text>
                <Text style={styles.timeUnit}>วินาที</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. แท็กดีลพิเศษ & เรตติ้ง */}
        <View style={styles.badgeRow}>
          <View style={styles.dealTag}>
            <Text style={styles.dealTagText}>🌱 ลดขยะอาหาร (Food Waste)</Text>
          </View>

          <View style={styles.ratingRow}>
            <MaterialIcons name="star" size={16} color="#f59e0b" />
            <Text style={styles.ratingText}>4.9 <Text style={styles.reviewCount}>(120 รีวิว)</Text></Text>
          </View>
        </View>

        {/* 4. ชื่อสินค้าและร้านค้า */}
        <Text style={styles.titleText}>{product?.name || 'อาหารส่วนเกินคุณภาพพรีเมียม'}</Text>
        <Text style={styles.shopNameText}>🏬 ร้านค้า: {product?.shop_name || 'ร้านค้าพรีเมียม'}</Text>

        {/* 5. แถวราคาและส่วนลด */}
        <View style={styles.priceRow}>
          <Text style={styles.priceCurrent}>
            ฿{Number(product?.discount_price || product?.original_price || 0).toLocaleString()}
          </Text>

          {product?.original_price > product?.discount_price && (
            <Text style={styles.priceOriginal}>
              ฿{Number(product.original_price).toLocaleString()}
            </Text>
          )}

          {product?.discount_percent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>-{product.discount_percent}%</Text>
            </View>
          )}
        </View>

        {/* 6. กล่องแสดงสถานะสต็อกสินค้าคงเหลือจริง (Stock Status Card) */}
        <View style={[
          styles.stockStatusCard,
          isOutOfStock ? styles.stockCardOut : isLowStock ? styles.stockCardLow : styles.stockCardNormal
        ]}>
          <View style={styles.stockStatusIconCol}>
            <MaterialIcons 
              name={isOutOfStock ? "error-outline" : isLowStock ? "local-fire-department" : "inventory-2"} 
              size={24} 
              color={isOutOfStock ? "#ef4444" : isLowStock ? "#ea580c" : "#16a34a"} 
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[
              styles.stockStatusTitle,
              isOutOfStock ? styles.stockTitleOut : isLowStock ? styles.stockTitleLow : styles.stockTitleNormal
            ]}>
              {isOutOfStock 
                ? 'สินค้าหมดชั่วคราว' 
                : isLowStock 
                ? `เหลือเพียง ${stock} ชิ้นสุดท้ายในวันนี้!` 
                : `มีสินค้าพร้อมส่ง: คงเหลือ ${stock} ชิ้น`}
            </Text>
            <Text style={styles.stockStatusDesc}>
              {isOutOfStock
                ? 'อาหารส่วนเกินรอบนี้ถูกสั่งซื้อหมดแล้ว โปรดติดตามรอบถัดไป'
                : 'อาหารส่วนเกินสดใหม่ประจำวัน มีจำนวนจำกัด หมดแล้วหมดเลย'}
            </Text>
          </View>
        </View>

        {/* 7. ตัวเลือกจำนวนสินค้า (Quantity Selector) */}
        {!isOutOfStock && (
          <View style={styles.quantitySection}>
            <Text style={styles.quantityLabel}>เลือกจำนวนที่ต้องการซื้อ:</Text>
            <View style={styles.stepperContainer}>
              <TouchableOpacity 
                style={[styles.stepperBtn, quantity <= 1 && styles.stepperBtnDisabled]} 
                onPress={handleDecreaseQty}
                disabled={quantity <= 1}
                activeOpacity={0.7}
              >
                <MaterialIcons name="remove" size={18} color={quantity <= 1 ? "#94a3b8" : "#16a34a"} />
              </TouchableOpacity>

              <Text style={styles.quantityValue}>{quantity}</Text>

              <TouchableOpacity 
                style={[styles.stepperBtn, quantity >= stock && styles.stepperBtnDisabled]} 
                onPress={handleIncreaseQty}
                disabled={quantity >= stock}
                activeOpacity={0.7}
              >
                <MaterialIcons name="add" size={18} color={quantity >= stock ? "#94a3b8" : "#16a34a"} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 8. ส่วนรายละเอียดสินค้า (Expandable) */}
        <Text style={styles.sectionHeading}>รายละเอียดสินค้า</Text>
        <Text 
          style={styles.descriptionText} 
          numberOfLines={isExpanded ? undefined : 3}
        >
          {product?.description || 'อาหารส่วนเกินคุณภาพพรีเมียมจากร้านอาหารชั้นนำ ปรุงสดใหม่วันต่อวัน คัดสรรวัตถุดิบอย่างดี เพื่อช่วยลดขยะอาหาร (Food Waste) และส่งมอบความคุ้มค่าให้คุณ'}
        </Text>
        <TouchableOpacity 
          onPress={() => setIsExpanded(!isExpanded)} 
          style={styles.expandBtn}
        >
          <Text style={styles.expandBtnText}>
            {isExpanded ? 'ย่อข้อความ ⌃' : 'ดูเพิ่มเติม ⌄'}
          </Text>
        </TouchableOpacity>

        {/* 9. Feature Pills (ความสดใหม่ & การจัดส่ง) */}
        <View style={styles.featureGrid}>
          <View style={styles.featurePill}>
            <MaterialIcons name="restaurant" size={20} color="#2e7a32" />
            <View style={styles.featureTextCol}>
              <Text style={styles.featureSubLabel}>ความสดใหม่</Text>
              <Text style={styles.featureMainLabel}>{product?.freshness || 'ทำสดใหม่ทุกเช้า'}</Text>
            </View>
          </View>

          <View style={styles.featurePill}>
            <MaterialIcons name="ac-unit" size={20} color="#2e7a32" />
            <View style={styles.featureTextCol}>
              <Text style={styles.featureSubLabel}>การจัดส่ง</Text>
              <Text style={styles.featureMainLabel}>{product?.shipping_type || 'ควบคุมอุณหภูมิ'}</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* 10. Bottom Action Bar */}
      <View style={styles.bottomBar}>
        {isOutOfStock ? (
          <View style={styles.disabledOrderBtn}>
            <MaterialIcons name="block" size={20} color="#94a3b8" />
            <Text style={styles.disabledOrderBtnText}>สินค้าหมดชั่วคราว</Text>
          </View>
        ) : (
          <>
            {/* ปุ่มใส่ตะกร้า */}
            <TouchableOpacity 
              style={[styles.cartBtn, addedToCart && styles.cartBtnAdded]} 
              onPress={handleAddToCart}
              activeOpacity={0.8}
            >
              <MaterialIcons 
                name={addedToCart ? 'check' : 'add-shopping-cart'} 
                size={22} 
                color="#16a34a" 
              />
            </TouchableOpacity>

            {/* ปุ่มซื้อเลย */}
            <TouchableOpacity 
              style={styles.buyNowBtn} 
              onPress={handleBuyNow}
              activeOpacity={0.8}
            >
              <MaterialIcons name="shopping-cart" size={20} color="#fff" />
              <Text style={styles.buyNowBtnText}>
                ซื้อเลย ({quantity} ชิ้น) • ฿{(Number(product?.discount_price || 0) * quantity).toLocaleString()}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fdfefe' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fdfefe'
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#0f172a' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 110 },
  
  imageCardContainer: {
    width: '100%',
    height: 300,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#111'
  },
  productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  productImageDisabled: { opacity: 0.5 },
  soldOutBanner: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 10
  },
  soldOutBannerText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  
  countdownBox: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(240, 245, 241, 0.95)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  countdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countdownLabel: { fontSize: 12, fontWeight: '600', color: '#334155' },
  timerGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeDigitBox: { alignItems: 'center' },
  timeDigit: { fontSize: 15, fontWeight: 'bold', color: '#16a34a' },
  timeUnit: { fontSize: 9, color: '#64748b', marginTop: -2 },
  colon: { fontSize: 14, fontWeight: 'bold', color: '#16a34a', marginBottom: 6 },
  
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dealTag: { backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  dealTagText: { color: '#16a34a', fontSize: 11, fontWeight: 'bold' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  reviewCount: { fontSize: 12, color: '#64748b', fontWeight: 'normal' },
  
  titleText: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 4, lineHeight: 26 },
  shopNameText: { fontSize: 13, color: '#16a34a', fontWeight: '600', marginBottom: 12 },
  
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  priceCurrent: { fontSize: 26, fontWeight: 'bold', color: '#16a34a' },
  priceOriginal: { fontSize: 15, color: '#94a3b8', textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  discountBadgeText: { color: '#ef4444', fontSize: 12, fontWeight: 'bold' },

  // Stock Status Card
  stockStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    gap: 12
  },
  stockCardNormal: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  stockCardLow: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  stockCardOut: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  stockStatusIconCol: { justifyContent: 'center', alignItems: 'center' },
  stockStatusTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  stockTitleNormal: { color: '#16a34a' },
  stockTitleLow: { color: '#ea580c' },
  stockTitleOut: { color: '#ef4444' },
  stockStatusDesc: { fontSize: 11, color: '#64748b' },

  // Quantity Stepper
  quantitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  quantityLabel: { fontSize: 13, fontWeight: 'bold', color: '#334155' },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  stepperBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  stepperBtnDisabled: { opacity: 0.4 },
  quantityValue: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', paddingHorizontal: 12 },

  sectionHeading: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginBottom: 6 },
  descriptionText: { fontSize: 13, color: '#475569', lineHeight: 20 },
  expandBtn: { alignSelf: 'flex-start', marginTop: 4, marginBottom: 18 },
  expandBtnText: { color: '#16a34a', fontSize: 13, fontWeight: '600' },
  featureGrid: { flexDirection: 'row', gap: 12, marginTop: 4 },
  featurePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10
  },
  featureTextCol: { flex: 1 },
  featureSubLabel: { fontSize: 10, color: '#64748b' },
  featureMainLabel: { fontSize: 12, fontWeight: 'bold', color: '#0f172a', marginTop: 1 },
  
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  cartBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#16a34a',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center'
  },
  cartBtnAdded: { backgroundColor: '#e8f5e9', borderColor: '#16a34a' },
  buyNowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: '#2e7a32',
    gap: 8
  },
  buyNowBtnText: { fontSize: 14, fontWeight: 'bold', color: '#fff' },

  disabledOrderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: '#f1f5f9',
    gap: 8
  },
  disabledOrderBtnText: { fontSize: 14, fontWeight: 'bold', color: '#94a3b8' }
});