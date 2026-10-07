import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Linking,
  Alert,
  Modal,
  TextInput,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';
import axios from 'axios';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, SERVER_URL } from '../constants/api';

const { width, height } = Dimensions.get('window');
const MapWebView = WebView as any;

export default function TrackingScreen() {
  const params = useLocalSearchParams();
  const id = params.id || params.order_id || params.orderId;
  const webViewRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [shop, setShop] = useState<any>(null);
  const [rider, setRider] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<any>(null);
  const userLocationRef = useRef<any>(null);
  
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Default coordinates - Mahasarakham City
  const [centerLat, setCenterLat] = useState(16.1852);
  const [centerLng, setCenterLng] = useState(103.3013);

  const getImageUrl = (imgUrl?: string) => {
    if (!imgUrl) return '';
    if (imgUrl.startsWith('data:') || imgUrl.startsWith('file://')) {
      return imgUrl;
    }
    if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
      return imgUrl.replace(/^http:\/\/(localhost|127\.0\.0\.1|202\.28\.34\.205)(:\d+)?/, SERVER_URL);
    }
    const cleanPath = imgUrl.startsWith('/') ? imgUrl : `/${imgUrl}`;
    if (cleanPath.startsWith('/uploads/')) {
      return `${SERVER_URL}${cleanPath}`;
    }
    return `${SERVER_URL}/uploads${cleanPath}`;
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let location = await Location.getCurrentPositionAsync({});
      setUserLocation(location.coords);
      userLocationRef.current = location.coords;
      setCenterLat(location.coords.latitude);
      setCenterLng(location.coords.longitude);
    })();
  }, []);

  const fetchTrackingData = async () => {
    try {
      const orderId = id || 1;
      const res = await axios.get(`${BASE_URL}/orders/${orderId}/tracking`);
      if (res.data?.success) {
        setOrder(res.data.order);
        setShop(res.data.shop);
        setRider(res.data.rider);

        if (res.data.rider?.lat && res.data.rider?.lng) {
          setCenterLat(res.data.rider.lat);
          setCenterLng(res.data.rider.lng);
          updateMapMarkers(res.data.shop, res.data.order, res.data.rider);
        } else if (res.data.shop?.lat && res.data.shop?.lng) {
          setCenterLat(res.data.shop.lat);
          setCenterLng(res.data.shop.lng);
          updateMapMarkers(res.data.shop, res.data.order, res.data.rider);
        }
      }
    } catch (error) {
      console.log('Error fetching tracking data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTrackingData();
      const interval = setInterval(fetchTrackingData, 6000);
      return () => clearInterval(interval);
    }, [id])
  );

  const updateMapMarkers = (s: any, o: any, r: any) => {
    const safeAddress = o?.shipping_address ? o.shipping_address.replace(/'/g, "\\'").replace(/\n/g, " ") : 'จัดส่งที่นี่';
    const safeShopName = s?.name ? s.name.replace(/'/g, "\\'").replace(/\n/g, " ") : 'ร้านอาหาร';
    
    const sLat = s?.lat || 16.1852;
    const sLng = s?.lng || 103.3013;
    
    const currentUserLoc = userLocationRef.current;
    const cLat = currentUserLoc?.latitude || o?.delivery_lat || sLat + 0.008;
    const cLng = currentUserLoc?.longitude || o?.delivery_lng || sLng + 0.005;
    
    const rLat = r?.lat || sLat + 0.001;
    const rLng = r?.lng || sLng + 0.001;

    const jsCode = `
      if (window.updateMarkers) {
        window.updateMarkers(
          ${sLat}, ${sLng}, 
          ${cLat}, ${cLng}, 
          ${rLat}, ${rLng},
          '${safeAddress}', '${safeShopName}'
        );
      }
      true;
    `;
    webViewRef.current?.injectJavaScript(jsCode);
  };

  const handleCallRider = () => {
    if (rider?.phone) {
      Linking.openURL(`tel:${rider.phone}`);
    } else {
      Alert.alert('แจ้งเตือน', 'ไม่พบเบอร์โทรศัพท์คนขับ');
    }
  };

  const handleCallShop = () => {
    if (shop?.phone) {
      Linking.openURL(`tel:${shop.phone}`);
    } else {
      Alert.alert('แจ้งเตือน', 'ไม่พบเบอร์โทรศัพท์ร้านค้า');
    }
  };

  const handleOpenChat = async (target: 'seller' | 'rider') => {
    let currentUserId = 1;
    try {
      const u = await AsyncStorage.getItem('user');
      if (u) {
        const parsed = JSON.parse(u);
        if (parsed.user_id) currentUserId = Number(parsed.user_id);
      }
    } catch (e) {}

    router.push({ 
      pathname: '/order-chat' as any, 
      params: { 
        order_id: order?.order_id || id, 
        role: 'buyer', 
        target: target,
        user_id: currentUserId 
      } 
    });
  };

  // Confirm Receipt & Release Escrow
  const handleConfirmReceived = () => {
    Alert.alert(
      'ยืนยันได้รับสินค้า',
      'คุณได้รับสินค้าถูกต้องครบถ้วนและต้องการยืนยันคำสั่งซื้อใช่หรือไม่? (ระบบจะโอนเงินให้ร้านค้าและไรเดอร์)',
      [
        { text: 'ตรวจสอบอีกครั้ง', style: 'cancel' },
        {
          text: 'ยืนยันรับสินค้าแล้ว',
          onPress: async () => {
            try {
              const res = await axios.put(`${BASE_URL}/orders/${order?.order_id || id}/complete`);
              if (res.data?.success) {
                Alert.alert('สำเร็จ', 'ขอบคุณที่ยืนยันการรับสินค้า กรุณาให้คะแนนความพึงพอใจ');
                fetchTrackingData();
                setShowRatingModal(true);
              }
            } catch (err: any) {
              console.error('Confirm received error:', err);
              Alert.alert('ผิดพลาด', err.response?.data?.message || 'ไม่สามารถยืนยันได้');
            }
          }
        }
      ]
    );
  };

  // Submit Rating
  const handleSubmitRating = async () => {
    setIsSubmittingRating(true);
    try {
      let currentUserId = 1;
      try {
        const u = await AsyncStorage.getItem('user');
        if (u) {
          const parsed = JSON.parse(u);
          if (parsed.user_id) currentUserId = Number(parsed.user_id);
        }
      } catch (e) {}

      await axios.post(`${BASE_URL}/reviews`, {
        order_id: order?.order_id || id,
        user_id: currentUserId,
        rating: selectedRating,
        comment: ratingComment
      });

      setShowRatingModal(false);
      Alert.alert('ขอบคุณ', 'บันทึกคะแนนรีวิวของคุณเรียบร้อยแล้ว');
      router.replace('/(tabs)/orders' as any);
    } catch (error) {
      console.error('Submit review error:', error);
      setShowRatingModal(false);
      router.replace('/(tabs)/orders' as any);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // Status mapping
  const getStatusIndex = (status: string) => {
    if (['pending', 'paid'].includes(status)) return 0;
    if (['preparing'].includes(status)) return 1;
    if (['ready'].includes(status)) return 2;
    if (['delivering', 'shipped'].includes(status)) return 3;
    if (['delivered'].includes(status)) return 4;
    if (['completed'].includes(status)) return 5;
    return 0;
  };

  const statusIdx = getStatusIndex(order?.status || 'preparing');

  const getStatusTitle = () => {
    if (statusIdx === 0) return 'ร้านค้ารับคำสั่งซื้อแล้ว';
    if (statusIdx === 1) return 'ร้านค้ากำลังจัดเตรียมสินค้า 🍳';
    if (statusIdx === 2) return 'สินค้าพร้อมแล้ว กำลังรอไรเดอร์มารับ 🛵';
    if (statusIdx === 3) return 'ไรเดอร์รับสินค้าแล้ว กำลังนำส่งคุณ 🛵💨';
    if (statusIdx === 4) return 'ไรเดอร์จัดส่งถึงที่หมายแล้ว 📦';
    if (statusIdx === 5) return 'คำสั่งซื้อสำเร็จสมบูรณ์ ✅';
    return 'กำลังดำเนินการ';
  };

  const formatThaiTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
  };

  // Leaflet Map HTML
  const leafletMapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #e2e8f0; }
        .shop-marker {
          background: #f57c00;
          color: white;
          border-radius: 50%;
          border: 2px solid white;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }
        .customer-marker {
          background: #3b82f6;
          color: white;
          border-radius: 50%;
          border: 2px solid white;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }
        .rider-marker-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-top: -20px;
        }
        .rider-eta {
          background: white;
          color: #16a34a;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          margin-bottom: 4px;
          white-space: nowrap;
        }
        .rider-icon {
          background: #16a34a;
          color: white;
          border-radius: 50%;
          border: 2px solid white;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false }).setView([${centerLat}, ${centerLng}], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        var shopMarker, customerMarker, riderMarker, routeLine;

        window.updateMarkers = function(sLat, sLng, cLat, cLng, rLat, rLng, custAddr, shopName) {
          if (shopMarker) map.removeLayer(shopMarker);
          if (customerMarker) map.removeLayer(customerMarker);
          if (riderMarker) map.removeLayer(riderMarker);
          if (routeLine) map.removeLayer(routeLine);

          var shopIcon = L.divIcon({
            className: 'custom-div-icon',
            html: "<div class='shop-marker'>🏪</div>",
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });
          shopMarker = L.marker([sLat, sLng], { icon: shopIcon }).addTo(map)
            .bindPopup("<b>" + shopName + "</b><br>ร้านค้า");

          var customerIcon = L.divIcon({
            className: 'custom-div-icon',
            html: "<div class='customer-marker'>📍</div>",
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });
          customerMarker = L.marker([cLat, cLng], { icon: customerIcon }).addTo(map)
            .bindPopup("<b>จุดส่งสินค้า</b><br>" + custAddr);

          var riderIcon = L.divIcon({
            className: 'custom-div-icon',
            html: "<div class='rider-marker-container'><div class='rider-eta'>ไรเดอร์</div><div class='rider-icon'>🛵</div></div>",
            iconSize: [60, 60],
            iconAnchor: [30, 45]
          });
          riderMarker = L.marker([rLat, rLng], { icon: riderIcon }).addTo(map);

          var latlngs = [[sLat, sLng], [rLat, rLng], [cLat, cLng]];
          routeLine = L.polyline(latlngs, { color: '#16a34a', weight: 4, dashArray: '6, 8' }).addTo(map);

          var bounds = L.latLngBounds([ [sLat, sLng], [cLat, cLng], [rLat, rLng] ]);
          map.fitBounds(bounds, { padding: [40, 40] });
        };
      </script>
    </body>
    </html>
  `;

  if (loading) {
    return (
      <SafeAreaView style={styles.centerLoading}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={{ marginTop: 10, color: '#64748b' }}>กำลังโหลดข้อมูลพิกัด...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ติดตามคำสั่งซื้อ #{order?.order_id || id}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Map View */}
      <View style={styles.mapContainer}>
        <MapWebView
          ref={webViewRef}
          source={{ html: leafletMapHTML }}
          style={styles.mapWebView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>

      {/* Bottom Sheet Details */}
      <ScrollView style={styles.bottomSheet} contentContainerStyle={styles.bottomSheetContent}>
        {/* Status Header */}
        <View style={styles.statusHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{getStatusTitle()}</Text>
            <Text style={styles.orderId}>คำสั่งซื้อ #{order?.order_id || id} • ชำระเงินแล้ว</Text>
          </View>
        </View>

        {/* Action Button: Confirm Receipt (When Delivered) */}
        {order?.status === 'delivered' && (
          <View style={styles.confirmBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="gift" size={24} color="#15803d" />
              <Text style={styles.confirmBoxTitle}>สินค้ามาถึงแล้ว กรุณาตรวจสอบ</Text>
            </View>
            <Text style={styles.confirmBoxSub}>
              เมื่อคุณตรวจสอบสินค้าเรียบร้อยแล้ว กรุณากดยืนยันรับสินค้าเพื่อปล่อยเงินให้ร้านค้าและไรเดอร์
            </Text>
            <TouchableOpacity style={styles.confirmReceivedBtn} onPress={handleConfirmReceived}>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.confirmReceivedBtnText}>ฉันได้รับสินค้าเรียบร้อยแล้ว</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Rider Card */}
        {rider ? (
          <View style={styles.riderCard}>
            <View style={styles.riderHeader}>
              <View style={styles.riderImgWrapper}>
                <Text style={{ fontSize: 28 }}>🛵</Text>
              </View>
              <View style={styles.riderInfo}>
                <Text style={styles.riderName}>{rider.name || 'ไรเดอร์ SmartDeal'}</Text>
                <Text style={styles.riderPlate}>ทะเบียน: {rider.vehicle_plate || 'มอเตอร์ไซค์รับจ้าง'}</Text>
                <View style={styles.riderRatingRow}>
                  <MaterialIcons name="star" size={14} color="#f59e0b" />
                  <Text style={styles.ratingText}>{rider.rating || '5.0'}</Text>
                  <Text style={styles.riderPhoneSmall}>• โทร {rider.phone || '-'}</Text>
                </View>
              </View>
              <View style={styles.riderActions}>
                <TouchableOpacity style={styles.actionIconBtn} onPress={handleCallRider}>
                  <Ionicons name="call" size={18} color="#16a34a" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionChatBtn, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]} onPress={() => handleOpenChat('rider')}>
                  <Ionicons name="chatbubbles" size={16} color="#16a34a" />
                  <Text style={styles.actionChatBtnText}>แชท</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.waitingRiderCard}>
            <Ionicons name="bicycle-outline" size={24} color="#64748b" />
            <Text style={styles.waitingRiderText}>
              {statusIdx <= 1 ? 'ร้านค้ากำลังเตรียมสินค้า จะมอบหมายไรเดอร์เมื่อพร้อมส่ง' : 'กำลังจัดหาไรเดอร์ที่ใกล้ที่สุด...'}
            </Text>
          </View>
        )}

        {/* Proof Photo: รูปถ่ายยืนยันการจัดส่งมอบสินค้า (แสดงเฉพาะตอนส่งมอบสินค้าแล้ว) */}
        {(order?.delivery_proof_image || order?.proof_image) && (
          <View style={styles.proofsSection}>
            <View style={[styles.proofItemCard, { backgroundColor: '#f0fdf4', borderColor: '#86efac', borderWidth: 1.5 }]}>
              <View style={styles.proofItemHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="checkmark-done-circle" size={18} color="#16a34a" />
                  <Text style={[styles.proofItemTitle, { color: '#15803d' }]}>รูปถ่ายยืนยันการส่งมอบสินค้า</Text>
                </View>
                <Text style={styles.proofItemTime}>{formatThaiTime(order.delivered_at)}</Text>
              </View>
              <TouchableOpacity 
                activeOpacity={0.88}
                onPress={() => setPreviewImage(getImageUrl(order.delivery_proof_image || order.proof_image))}
                style={styles.proofImgFrame}
              >
                <Image source={{ uri: getImageUrl(order.delivery_proof_image || order.proof_image) }} style={styles.proofImg} resizeMode="cover" />
                <View style={[styles.expandPill, { backgroundColor: 'rgba(22, 163, 74, 0.75)' }]}>
                  <Ionicons name="expand" size={12} color="#fff" />
                  <Text style={styles.expandPillText}>แตะดูรูป</Text>
                </View>
              </TouchableOpacity>
              <Text style={[styles.proofSubText, { color: '#166534' }]}>✓ ไรเดอร์ส่งมอบสินค้าถึงมือผู้รับเรียบร้อยแล้ว</Text>
            </View>
          </View>
        )}

        {/* Location & Shop Card */}
        <View style={styles.locationCard}>
          {/* Shop */}
          <View style={styles.locationItem}>
            <View style={[styles.locationDot, { backgroundColor: '#f57c00' }]} />
            <View style={styles.locationContent}>
              <Text style={styles.locationLabel}>ร้านค้า</Text>
              <View style={styles.locationTitleRow}>
                <Text style={styles.locationTitle} numberOfLines={1}>{shop?.name || 'ร้านค้า'}</Text>
                <View style={styles.locationShopActions}>
                  <TouchableOpacity style={styles.locIconBtn} onPress={handleCallShop}>
                    <Ionicons name="call" size={16} color="#f57c00" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.locChatBtn, { backgroundColor: '#fffbeb', borderColor: '#fed7aa' }]} onPress={() => handleOpenChat('seller')}>
                    <Ionicons name="storefront" size={14} color="#d97706" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#d97706', marginLeft: 3 }}>แชทร้านค้า</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.locationDesc} numberOfLines={2}>{shop?.address || 'ที่อยู่ร้านค้า'}</Text>
            </View>
          </View>

          <View style={styles.locationDivider} />

          {/* Destination */}
          <View style={styles.locationItem}>
            <View style={[styles.locationDot, { backgroundColor: '#3b82f6' }]} />
            <View style={styles.locationContent}>
              <Text style={styles.locationLabel}>จุดส่งสินค้าของคุณ</Text>
              <Text style={styles.locationTitle}>{order?.receiver_name || 'สถานที่จัดส่ง'}</Text>
              <Text style={styles.locationDesc}>{order?.shipping_address || 'ที่อยู่จัดส่ง'}</Text>
              {order?.note_for_rider && (
                <Text style={styles.riderNoteText}>📝 ข้อความถึงคนขับ: {order.note_for_rider}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Timeline */}
        <View style={styles.timelineContainer}>
          <Text style={styles.timelineHeader}>ลำดับสถานะคำสั่งซื้อ</Text>

          {[
            { title: 'รับคำสั่งซื้อเรียบร้อย', desc: 'ร้านค้าได้รับคำสั่งซื้อของคุณแล้ว', time: formatThaiTime(order?.created_at), active: statusIdx >= 0 },
            { title: 'ร้านค้ากำลังเตรียมสินค้า', desc: 'ร้านค้ากำลังปรุงหรือเตรียมสินค้า', time: formatThaiTime(order?.prepared_at), active: statusIdx >= 1 },
            { title: 'สินค้าพร้อมส่ง (รอไรเดอร์)', desc: 'สินค้าบรรจุเสร็จพร้อมส่งมอบให้ไรเดอร์', time: '', active: statusIdx >= 2 },
            { title: 'ไรเดอร์รับสินค้าแล้ว กำลังนำส่ง', desc: 'ไรเดอร์รับของจากร้านและกำลังเดินทางมาส่งคุณ', time: formatThaiTime(order?.picked_up_at || order?.pickup_at), active: statusIdx >= 3 },
            { title: 'จัดส่งถึงที่หมายแล้ว', desc: 'ไรเดอร์นำส่งถึงปลายทางพร้อมถ่ายรูปยืนยัน', time: formatThaiTime(order?.delivered_at), active: statusIdx >= 4 },
            { title: 'คำสั่งซื้อสำเร็จสมบูรณ์', desc: 'ลูกค้ายืนยันรับสินค้าและปล่อยเงิน Escrow', time: '', active: statusIdx >= 5 },
          ].map((item, idx) => (
            <View key={idx} style={styles.timelineStep}>
              <View style={styles.timelineIconContainer}>
                <View style={[styles.timelineIcon, item.active && styles.timelineIconActive]}>
                  <Ionicons name={item.active ? "checkmark" : "ellipse"} size={12} color={item.active ? "#fff" : "#94a3b8"} />
                </View>
                {idx < 5 && <View style={[styles.timelineLine, item.active && styles.timelineLineActive]} />}
              </View>
              <View style={styles.timelineContent}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.timelineTitle, item.active && styles.timelineTitleActive]}>{item.title}</Text>
                  {!!item.time && <Text style={styles.timelineTime}>{item.time}</Text>}
                </View>
                <Text style={styles.timelineSub}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.dragHandle} />
            <Text style={styles.modalTitle}>ให้คะแนนความพึงพอใจ ⭐</Text>
            <Text style={styles.modalSubTitle}>ช่วยให้คะแนนร้านค้าและไรเดอร์เพื่อพัฒนาการบริการ</Text>

            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setSelectedRating(star)}>
                  <MaterialIcons
                    name={star <= selectedRating ? 'star' : 'star-border'}
                    size={38}
                    color="#f59e0b"
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.commentInput}
              placeholder="แสดงความคิดเห็นเพิ่มเติม (ถ้ามี)..."
              placeholderTextColor="#94a3b8"
              value={ratingComment}
              onChangeText={setRatingComment}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => {
                  setShowRatingModal(false);
                  router.replace('/(tabs)/orders' as any);
                }}
              >
                <Text style={styles.modalCancelText}>ข้าม</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSubmitBtn} 
                onPress={handleSubmitRating}
                disabled={isSubmittingRating}
              >
                {isSubmittingRating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitText}>ส่งคะแนน</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Image Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.fullImageModal}>
          <TouchableOpacity 
            style={styles.modalCloseBtn}
            onPress={() => setPreviewImage(null)}
          >
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
          {previewImage && (
            <Image 
              source={{ uri: previewImage }} 
              style={styles.fullImage} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerLoading: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 10
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  mapContainer: {
    height: '35%',
    width: '100%',
    backgroundColor: '#e2e8f0'
  },
  mapWebView: {
    flex: 1,
    backgroundColor: '#e2e8f0'
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8
  },
  bottomSheetContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 40,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#16a34a'
  },
  orderId: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },

  confirmBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  confirmBoxTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#15803d',
  },
  confirmBoxSub: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
    marginBottom: 12,
  },
  confirmReceivedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmReceivedBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },

  riderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  riderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riderImgWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  riderInfo: { flex: 1 },
  riderName: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  riderPlate: { fontSize: 12, color: '#64748b', marginTop: 2 },
  riderRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  ratingText: { fontSize: 12, fontWeight: 'bold', color: '#d97706' },
  riderPhoneSmall: { fontSize: 11, color: '#64748b' },
  riderActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  actionChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  actionChatBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#16a34a',
  },

  waitingRiderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    gap: 10,
  },
  waitingRiderText: {
    flex: 1,
    fontSize: 13,
    color: '#64748b',
  },

  proofsSection: {
    marginBottom: 16,
    gap: 10,
  },
  proofItemCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  proofItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  proofItemTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#166534',
  },
  proofItemTime: {
    fontSize: 11,
    color: '#64748b',
  },
  proofImgFrame: {
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
    marginBottom: 6,
  },
  proofImg: {
    width: '100%',
    height: '100%',
  },
  expandPill: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  expandPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  proofSubText: {
    fontSize: 12,
    color: '#166534',
  },

  locationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  locationItem: {
    flexDirection: 'row',
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: 12
  },
  locationContent: { flex: 1 },
  locationLabel: { fontSize: 12, color: '#64748b', marginBottom: 2 },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  locationTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', flex: 1 },
  locationShopActions: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  locIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  locChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 15,
    borderWidth: 1,
  },
  locationDesc: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  riderNoteText: { fontSize: 12, color: '#ef4444', marginTop: 4, fontStyle: 'italic' },
  locationDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
    marginLeft: 22,
  },

  timelineContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 20,
  },
  timelineHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 14,
  },
  timelineStep: { flexDirection: 'row' },
  timelineIconContainer: { alignItems: 'center', marginRight: 12 },
  timelineIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2
  },
  timelineIconActive: { backgroundColor: '#16a34a' },
  timelineLine: {
    width: 2,
    height: 36,
    backgroundColor: '#e2e8f0',
    zIndex: 1
  },
  timelineLineActive: { backgroundColor: '#16a34a' },
  timelineContent: { flex: 1, paddingBottom: 16 },
  timelineTitle: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  timelineTitleActive: { color: '#0f172a', fontWeight: 'bold' },
  timelineTime: { fontSize: 11, color: '#64748b' },
  timelineSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  dragHandle: {
    width: 44,
    height: 5,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    marginBottom: 16
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 6 },
  modalSubTitle: { fontSize: 13, color: '#64748b', marginBottom: 20, textAlign: 'center' },
  starsContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  commentInput: {
    width: '100%',
    height: 90,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    textAlignVertical: 'top',
    marginBottom: 20
  },
  modalActions: { flexDirection: 'row', width: '100%', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center'
  },
  modalCancelText: { color: '#64748b', fontSize: 15, fontWeight: 'bold' },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#16a34a',
    alignItems: 'center',
  },
  modalSubmitText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },

  fullImageModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 20,
  },
  fullImage: {
    width: width * 0.95,
    height: height * 0.8,
  }
});
