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
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';
import axios from 'axios';
import * as Location from 'expo-location';
import { BASE_URL } from '../constants/api';

const MapWebView = WebView as any;

export default function TrackingScreen() {
  const { id } = useLocalSearchParams();
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

  // Default coordinates (used if none provided) - Mahasarakham City
  const [centerLat, setCenterLat] = useState(16.1852);
  const [centerLng, setCenterLng] = useState(103.3013);

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
      const orderId = id || 1; // Fallback to 1 for testing if not provided
      const res = await axios.get(`${BASE_URL}/orders/${orderId}/tracking`);
      if (res.data?.success) {
        setOrder(res.data.order);
        setShop(res.data.shop);
        setRider(res.data.rider);

        // Update map center to rider or shop
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
      const interval = setInterval(fetchTrackingData, 10000); // Poll every 10s
      return () => clearInterval(interval);
    }, [id])
  );

  const updateMapMarkers = (s: any, o: any, r: any) => {
    // Escape quotes to prevent JS injection errors
    const safeAddress = o?.shipping_address ? o.shipping_address.replace(/'/g, "\\'").replace(/\n/g, " ") : 'จัดส่งที่นี่';
    const safeShopName = s?.name ? s.name.replace(/'/g, "\\'").replace(/\n/g, " ") : 'ร้านอาหาร';
    
    const sLat = s?.lat || 13.736717;
    const sLng = s?.lng || 100.523186;
    
    // Customer fallback
    const currentUserLoc = userLocationRef.current;
    const cLat = currentUserLoc?.latitude || o?.delivery_lat || sLat + 0.008;
    const cLng = currentUserLoc?.longitude || o?.delivery_lng || sLng + 0.005;
    
    // Rider fallback (starts near shop)
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

  const handleCall = () => {
    if (rider?.phone) {
      Linking.openURL(`tel:${rider.phone}`);
    } else {
      Alert.alert('แจ้งเตือน', 'ไม่พบเบอร์โทรศัพท์คนขับ');
    }
  };

  const handleChat = () => {
    router.push({ pathname: '/order-chat', params: { orderId: order?.order_id || id, riderId: rider?.rider_id } });
  };

  const handleShopCall = () => {
    if (shop?.phone) {
      Linking.openURL(`tel:${shop.phone}`);
    } else {
      Alert.alert('แจ้งเตือน', 'ไม่พบเบอร์โทรศัพท์ร้านค้า');
    }
  };

  const handleShopChat = () => {
    router.push({ pathname: '/order-chat', params: { orderId: order?.order_id || id, shopId: shop?.shop_id } });
  };

  // Helper to determine status index
  const getStatusIndex = (status: string) => {
    if (['pending', 'paid'].includes(status)) return 0;
    if (['preparing'].includes(status)) return 1;
    if (['ready'].includes(status)) return 2;
    if (['finding_rider', 'heading_to_shop', 'shipped'].includes(status)) return 3;
    if (['delivering'].includes(status)) return 4;
    if (['completed', 'delivered'].includes(status)) return 5;
    return 0;
  };

  const statusIdx = getStatusIndex(order?.status || 'heading_to_shop');

  const getStatusTitle = () => {
    if (statusIdx <= 1) return 'กำลังจัดเตรียมสินค้า';
    if (statusIdx <= 3) return 'คนขับกำลังไปรับสินค้า';
    if (statusIdx === 4) return 'กำลังนำส่งสินค้า';
    if (statusIdx >= 5) return 'สินค้ามาถึงแล้ว';
    return 'กำลังดำเนินการ';
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
  };

  // HTML for Leaflet Map
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
        
        /* Custom Marker Styles */
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
          border: 3px solid white;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        
        .map-tooltip {
          background-color: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 6px 10px;
          font-family: sans-serif;
          font-size: 13px;
          font-weight: bold;
          color: #0f172a;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          white-space: nowrap;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${centerLat}, ${centerLng}], 14);
        
        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          maxZoom: 19
        }).addTo(map);

        var shopMarker, customerMarker, riderMarker;

        var shopIcon = L.divIcon({ className: 'custom-div-icon', html: '<div class="shop-marker">🏪</div>', iconSize: [32, 32], iconAnchor: [16, 16] });
        var customerIcon = L.divIcon({ className: 'custom-div-icon', html: '<div class="customer-marker">📍</div>', iconSize: [32, 32], iconAnchor: [16, 16] });
        var riderIcon = L.divIcon({ className: 'custom-div-icon', html: '<div class="rider-marker-container"><div class="rider-eta">5 นาที</div><div class="rider-icon">🛵</div></div>', iconSize: [46, 66], iconAnchor: [23, 60] });

        window.updateMarkers = function(sLat, sLng, cLat, cLng, rLat, rLng, cAddress, sName) {
          var bounds = [];
          
          if (sLat && sLng) {
            if (!shopMarker) {
              shopMarker = L.marker([sLat, sLng], {icon: shopIcon}).addTo(map);
              if (sName) shopMarker.bindTooltip(sName, { permanent: true, direction: 'top', offset: [0, -20], className: 'map-tooltip' });
            } else {
              shopMarker.setLatLng([sLat, sLng]);
              if (sName) shopMarker.setTooltipContent(sName);
            }
            bounds.push([sLat, sLng]);
          }
          
          if (cLat && cLng) {
            if (!customerMarker) {
              customerMarker = L.marker([cLat, cLng], {icon: customerIcon}).addTo(map);
              if (cAddress) customerMarker.bindTooltip(cAddress, { permanent: true, direction: 'top', offset: [0, -20], className: 'map-tooltip' });
            } else {
              customerMarker.setLatLng([cLat, cLng]);
              if (cAddress) customerMarker.setTooltipContent(cAddress);
            }
            bounds.push([cLat, cLng]);
          }
          
          if (rLat && rLng) {
            if (!riderMarker) riderMarker = L.marker([rLat, rLng], {icon: riderIcon}).addTo(map);
            else riderMarker.setLatLng([rLat, rLng]);
            bounds.push([rLat, rLng]);
          }

          // Draw dashed route line
          if (sLat && cLat) {
            if (window.routeLine) {
              map.removeLayer(window.routeLine);
            }
            window.routeLine = L.polyline([[sLat, sLng], [cLat, cLng]], {color: '#16a34a', dashArray: '10, 10', weight: 4}).addTo(map);
          }

          if (bounds.length > 1) {
            map.fitBounds(bounds, { padding: [50, 50] });
          } else if (bounds.length === 1) {
            map.setView(bounds[0], 15);
          }
        };

        // Initialize with default/fetched data
        setTimeout(function() {
          var safeAddr = ${JSON.stringify(order?.shipping_address || 'จัดส่งที่นี่')};
          var safeShop = ${JSON.stringify(shop?.name || 'ร้านอาหาร')};
          
          var sLat = ${shop?.lat || 'null'};
          var sLng = ${shop?.lng || 'null'};
          var cLat = ${userLocation?.latitude || order?.delivery_lat || 'null'};
          var cLng = ${userLocation?.longitude || order?.delivery_lng || 'null'};
          var rLat = ${rider?.lat || 'null'};
          var rLng = ${rider?.lng || 'null'};
          
          sLat = sLat || 16.1852;
          sLng = sLng || 103.3013;
          cLat = cLat || (sLat + 0.008);
          cLng = cLng || (sLng + 0.005);
          rLat = rLat || (sLat + 0.001);
          rLng = rLng || (sLng + 0.001);
          
          window.updateMarkers(
            sLat, sLng,
            cLat, cLng,
            rLat, rLng,
            safeAddr || 'จัดส่งที่นี่', safeShop || 'ร้านอาหาร'
          );
        }, 500);
      </script>
    </body>
    </html>
  `;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={{ marginTop: 12, color: '#64748b' }}>กำลังโหลดข้อมูลการติดตาม...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ติดตามสถานะคำสั่งซื้อ</Text>
        <TouchableOpacity style={styles.helpBtn}>
          <MaterialIcons name="help-outline" size={24} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {/* Map Section */}
      <View style={styles.mapContainer}>
        <MapWebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: leafletMapHTML }}
          style={styles.mapWebView}
          javaScriptEnabled={true}
          scrollEnabled={false}
        />
      </View>

      {/* Bottom Sheet Details */}
      <View style={styles.bottomSheet}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          
          {/* Status Header */}
          <View style={styles.statusHeaderRow}>
            <View>
              <Text style={styles.statusTitle}>{getStatusTitle()}</Text>
              <Text style={styles.orderId}>เลขที่อ้างอิง: #SD-{order?.order_id || '9925'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.etaLabel}>เวลาที่คาดถึง</Text>
              <Text style={styles.etaTime}>12:45 น.</Text>
            </View>
          </View>

          {/* Location Details Card */}
          <View style={styles.locationCard}>
            <View style={styles.locationConnectionLine} />
            
            {/* Shop Location */}
            <View style={styles.locationItem}>
              <View style={[styles.locationDot, { backgroundColor: '#ef4444' }]} />
              <View style={styles.locationContent}>
                <Text style={styles.locationLabel}>รับคำสั่งซื้อจาก</Text>
                
                <View style={styles.locationTitleRow}>
                  <Text style={styles.locationTitle} numberOfLines={1}>{shop?.name || 'ร้านอาหาร'}</Text>
                  <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                </View>
                
                <Text style={styles.locationDesc}>{shop?.address || 'ไม่มีข้อมูลที่อยู่'}</Text>
              </View>
            </View>

            <View style={{ height: 24 }} />

            {/* Delivery Location */}
            <View style={styles.locationItem}>
              <View style={[styles.locationDot, { backgroundColor: '#10b981' }]} />
              <View style={styles.locationContent}>
                <Text style={styles.locationLabel}>จัดส่งที่</Text>
                <Text style={styles.locationTitle}>{order?.shipping_address || 'ที่อยู่จัดส่งของคุณ'}</Text>
                <Text style={styles.locationDesc}>{order?.receiver_name || 'ลูกค้า'} - {order?.receiver_phone || ''}</Text>

                {statusIdx >= 5 && (
                  <TouchableOpacity style={styles.proofLink}>
                    <MaterialCommunityIcons name="image-outline" size={18} color="#3b82f6" />
                    <Text style={styles.proofText}>หลักฐานการจัดส่งอาหาร</Text>
                    <MaterialIcons name="chevron-right" size={18} color="#3b82f6" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Timeline */}
          <View style={styles.timelineContainer}>
            {/* Step 1: Preparing */}
            <View style={styles.timelineStep}>
              <View style={styles.timelineIconContainer}>
                <View style={[styles.timelineIcon, statusIdx >= 1 ? styles.timelineIconActive : {}]}>
                  {statusIdx >= 1 ? <MaterialIcons name="check" size={14} color="#fff" /> : null}
                </View>
                <View style={[styles.timelineLine, statusIdx >= 2 ? styles.timelineLineActive : {}]} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, statusIdx >= 1 ? styles.timelineTitleActive : {}]}>คำสั่งจัดเตรียมสินค้า</Text>
                <Text style={styles.timelineSub}>{order?.prepared_at ? `เสร็จสิ้นเมื่อ ${formatTime(order.prepared_at)}` : (statusIdx >= 1 ? 'ดำเนินการแล้ว' : 'รอการดำเนินการ')}</Text>
              </View>
            </View>

            {/* Step 2: Going to pick up / Picked up */}
            <View style={styles.timelineStep}>
              <View style={styles.timelineIconContainer}>
                <View style={[styles.timelineIcon, statusIdx >= 3 ? styles.timelineIconActive : {}]}>
                  {statusIdx >= 3 ? <MaterialCommunityIcons name="motorbike" size={14} color="#fff" /> : null}
                </View>
                <View style={[styles.timelineLine, statusIdx >= 4 ? styles.timelineLineActive : {}]} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, statusIdx >= 3 ? styles.timelineTitleActive : {}]}>คนขับกำลังไปรับสินค้า</Text>
                <Text style={styles.timelineSub}>{order?.picked_up_at ? `รับสินค้าเมื่อ ${formatTime(order.picked_up_at)}` : (statusIdx >= 3 ? 'กำลังดำเนินการ' : 'รอการดำเนินการ')}</Text>
              </View>
            </View>

            {/* Step 3: Delivering */}
            <View style={styles.timelineStep}>
              <View style={styles.timelineIconContainer}>
                <View style={[styles.timelineIcon, statusIdx >= 4 ? styles.timelineIconActive : {}]}>
                  {statusIdx >= 4 ? <Ionicons name="navigate" size={12} color="#fff" /> : null}
                </View>
                <View style={[styles.timelineLine, statusIdx >= 5 ? styles.timelineLineActive : {}]} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, statusIdx >= 4 ? styles.timelineTitleActive : {}]}>กำลังนำส่งสินค้า</Text>
                <Text style={styles.timelineSub}>{statusIdx >= 4 && statusIdx < 5 ? 'กำลังดำเนินการ' : 'รอการดำเนินการ'}</Text>
              </View>
            </View>

            {/* Step 4: Completed */}
            <View style={styles.timelineStep}>
              <View style={styles.timelineIconContainer}>
                <View style={[styles.timelineIcon, statusIdx >= 5 ? styles.timelineIconActive : {}]}>
                  {statusIdx >= 5 ? <MaterialIcons name="check" size={14} color="#fff" /> : null}
                </View>
              </View>
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, statusIdx >= 5 ? styles.timelineTitleActive : {}]}>สินค้ามาถึงแล้ว</Text>
                <Text style={styles.timelineSub}>{order?.delivered_at ? `จัดส่งสำเร็จเมื่อ ${formatTime(order.delivered_at)}` : 'รอการดำเนินการ'}</Text>
              </View>
            </View>
          </View>

          {/* Rider Info Card */}
          {rider?.name ? (
            <View style={styles.riderCard}>
              <View style={styles.riderHeader}>
                <View style={styles.riderImgWrapper}>
                  <Image source={{ uri: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200' }} style={styles.riderImg} />
                </View>
                <View style={styles.riderInfo}>
                  <Text style={styles.riderName}>
                    {rider?.name}
                  </Text>
                  <Text style={styles.riderPlate}>
                    ทะเบียน {rider?.vehicle_plate}
                  </Text>
                  <Text style={styles.riderVaccine}>ฉีดวัคซีนแล้ว 3 เข็ม</Text>
                </View>
                <View style={styles.riderRating}>
                  <MaterialIcons name="star" size={14} color="#f59e0b" />
                  <Text style={styles.ratingText}>{rider?.rating}</Text>
                </View>
              </View>

              <View style={styles.riderActions}>
                <TouchableOpacity style={styles.actionIconBtn} onPress={handleCall}>
                  <MaterialIcons name="phone" size={20} color="#16a34a" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionIconBtn} onPress={handleChat}>
                  <MaterialCommunityIcons name="chat-processing" size={20} color="#16a34a" />
                </TouchableOpacity>
                
                {statusIdx >= 5 && (
                  <TouchableOpacity style={styles.rateBtn} onPress={() => setShowRatingModal(true)}>
                    <MaterialIcons name="star" size={18} color="#d97706" />
                    <Text style={styles.rateBtnText}>ให้คะแนนคนขับ</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={[styles.riderCard, {alignItems: 'center', paddingVertical: 24}]}>
              <MaterialCommunityIcons name="motorbike" size={48} color="#cbd5e1" />
              <Text style={{marginTop: 8, color: '#64748b', fontSize: 16}}>ระบบกำลังค้นหาคนขับให้คุณ...</Text>
            </View>
          )}
          
        </ScrollView>
      </View>

      {/* Rating Bottom Sheet Modal */}
      <Modal visible={showRatingModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Drag Handle */}
            <View style={styles.dragHandle} />
            
            <Text style={styles.modalTitle}>ให้คะแนนคนขับ</Text>
            <Text style={styles.modalSubTitle}>การจัดส่งของ {rider?.name || 'คนขับ'} เป็นอย่างไรบ้าง?</Text>
            
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity 
                  key={star} 
                  onPress={() => setSelectedRating(star)}
                  style={{ padding: 4 }}
                >
                  <MaterialIcons 
                    name={star <= selectedRating ? "star" : "star-border"} 
                    size={46} 
                    color={star <= selectedRating ? "#f59e0b" : "#e2e8f0"} 
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.commentInput}
              placeholder="พิมพ์คำติชมหรือความประทับใจ (ไม่บังคับ)..."
              placeholderTextColor="#94a3b8"
              multiline
              value={ratingComment}
              onChangeText={setRatingComment}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowRatingModal(false)}>
                <Text style={styles.modalCancelText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSubmitBtn} 
                onPress={() => {
                  Alert.alert('ขอบคุณ', 'เราได้รับคะแนนของคุณแล้ว');
                  setShowRatingModal(false);
                  setRatingComment('');
                  setSelectedRating(5);
                }}
              >
                <Text style={styles.modalSubmitText}>ส่งคะแนน</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    zIndex: 10
  },
  backBtn: {
    padding: 4
  },
  helpBtn: {
    padding: 4
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  mapContainer: {
    height: '40%',
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
    marginTop: -20, // Overlap map
    paddingHorizontal: 20,
    paddingTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a'
  },
  orderId: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4
  },
  etaLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 2
  },
  etaTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  locationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  locationConnectionLine: {
    position: 'absolute',
    left: 20,
    top: 32,
    bottom: 32,
    width: 2,
    backgroundColor: '#f1f5f9',
    zIndex: 1
  },
  locationItem: {
    flexDirection: 'row',
    zIndex: 2
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: 12
  },
  locationContent: {
    flex: 1
  },
  locationLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginRight: 4,
    flexShrink: 1
  },
  locationShopActions: {
    flexDirection: 'row',
    gap: 8
  },
  locIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  locationDesc: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20
  },
  proofLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 4
  },
  proofText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500'
  },
  timelineContainer: {
    marginBottom: 24,
    paddingLeft: 8
  },
  timelineStep: {
    flexDirection: 'row',
    marginBottom: 0
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 16
  },
  timelineIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2
  },
  timelineIconActive: {
    backgroundColor: '#16a34a'
  },
  timelineLine: {
    width: 2,
    height: 40,
    backgroundColor: '#e2e8f0',
    marginTop: -2,
    marginBottom: -2,
    zIndex: 1
  },
  timelineLineActive: {
    backgroundColor: '#16a34a'
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 24,
    paddingTop: 2
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b'
  },
  timelineTitleActive: {
    color: '#0f172a'
  },
  timelineSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4
  },
  addressCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginLeft: 8
  },
  addressText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginLeft: 32
  },
  riderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16
  },
  riderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  riderImgWrapper: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e2e8f0',
    marginRight: 12,
    overflow: 'hidden'
  },
  riderImg: {
    width: '100%',
    height: '100%'
  },
  riderInfo: {
    flex: 1
  },
  riderName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  riderPlate: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2
  },
  riderVaccine: {
    fontSize: 11,
    color: '#16a34a',
    marginTop: 4,
    fontWeight: '500'
  },
  riderRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start'
  },
  ratingText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#d97706',
    marginLeft: 4
  },
  riderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  actionIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center'
  },
  rateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    height: 44,
    borderRadius: 22,
    gap: 8
  },
  rateBtnText: {
    color: '#d97706',
    fontSize: 14,
    fontWeight: 'bold'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)', // Darker overlay for premium feel
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20
  },
  dragHandle: {
    width: 48,
    height: 5,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6
  },
  modalSubTitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28
  },
  commentInput: {
    width: '100%',
    height: 100,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 16,
    paddingTop: 16,
    fontSize: 15,
    color: '#0f172a',
    textAlignVertical: 'top',
    marginBottom: 28
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 16
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center'
  },
  modalCancelText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: 'bold'
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  modalSubmitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});
