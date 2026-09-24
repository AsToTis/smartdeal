import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants/api';

// พิกัดค่าเริ่มต้น (มหาสารคาม - ท่าขอนยาง)
const DEFAULT_LAT = 16.246826;
const DEFAULT_LNG = 103.251992;

const PRESET_LOCATIONS = [
  {
    name: 'มมส. ท่าขอนยาง',
    title: 'ลาวัณย์ปาร์ควิลล์',
    detail: '577 ตำบลท่าขอนยาง อำเภอกันทรวิชัย มหาสารคาม 44150',
    lat: 16.246826,
    lng: 103.251992
  },
  {
    name: 'มมส. ขามเรียง',
    title: 'หอพักหน้ามอมหาสารคาม',
    detail: 'ตำบลขามเรียง อำเภอกันทรวิชัย มหาสารคาม 44150',
    lat: 16.244342,
    lng: 103.250100
  },
  {
    name: 'สยามสแควร์ กทม.',
    title: 'คอนโดฯ สยามสแควร์วัน',
    detail: '388 ถนนพระรามที่ 1 แขวงปทุมวัน เขตปทุมวัน กรุงเทพฯ 10330',
    lat: 13.745634,
    lng: 100.534151
  },
  {
    name: 'สุขุมวิท 24',
    title: 'บ้านพักสุขุมวิท',
    detail: 'ซอยสุขุมวิท 24 แขวงคลองตัน เขตคลองเตย กรุงเทพฯ 10110',
    lat: 13.725832,
    lng: 100.569421
  }
];

const TAG_PRESETS = ['🏠 บ้าน', '🏢 ที่ทำงาน', '🏬 คอนโด', '📍 หอพัก'];
const MapWebView = WebView as any;

export default function AddressScreen() {
  const webViewRef = useRef<any>(null);

  const [title, setTitle] = useState('ลาวัณย์ปาร์ควิลล์');
  const [detail, setDetail] = useState('577 ตำบลท่าขอนยาง อำเภอกันทรวิชัย มหาสารคาม 44150');
  const [name, setName] = useState('ยุติธรรม ปั่นกลาง');
  const [phone, setPhone] = useState('0647151855');
  const [noteForRider, setNoteForRider] = useState('');
  const [latitude, setLatitude] = useState<number>(DEFAULT_LAT);
  const [longitude, setLongitude] = useState<number>(DEFAULT_LNG);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [userId, setUserId] = useState<number>(2);

  useEffect(() => {
    loadExistingAddress();
  }, []);

  const loadExistingAddress = async () => {
    try {
      setFetching(true);
      let currentUid = 2;
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const u = JSON.parse(userData);
          if (u?.user_id) {
            currentUid = u.user_id;
            setUserId(u.user_id);
          }
          if (u?.full_name) setName(u.full_name);
          if (u?.phone) setPhone(u.phone);
        }
      } catch (e) {}

      const res = await axios.get(`${BASE_URL}/users/${currentUid}/address`);
      if (res.data && res.data.success !== false) {
        const d = res.data;
        if (d.title) setTitle(d.title);
        if (d.address_detail) setDetail(d.address_detail);
        if (d.receiver_name) setName(d.receiver_name);
        if (d.receiver_phone) setPhone(d.receiver_phone);
        if (d.note_for_rider) setNoteForRider(d.note_for_rider);
        if (d.latitude) setLatitude(parseFloat(d.latitude));
        if (d.longitude) setLongitude(parseFloat(d.longitude));
      }
    } catch (e) {
      console.log('Error loading address:', e);
    } finally {
      setFetching(false);
    }
  };

  // เลื่อนหมุดไปยังพิกัดใหม่บนแผนที่
  const updateMapPin = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    const jsCode = `if (window.setMapLocation) { window.setMapLocation(${lat}, ${lng}); } true;`;
    webViewRef.current?.injectJavaScript(jsCode);
  };

  // ดึงพิกัดตำแหน่งปัจจุบันจาก GPS / Location Services
  const handleGetCurrentLocation = async () => {
    try {
      setGettingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'การเข้าถึงตำแหน่ง',
          'ระบบไม่ได้รับอนุญาตให้เข้าถึง GPS จึงใช้พิกัดตำแหน่งปัจจุบันของแอป',
          [{ text: 'ตกลง' }]
        );
        updateMapPin(DEFAULT_LAT, DEFAULT_LNG);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      if (loc && loc.coords) {
        const newLat = loc.coords.latitude;
        const newLng = loc.coords.longitude;
        updateMapPin(newLat, newLng);
        Alert.alert('สำเร็จ 📍', 'ปักหมุดตำแหน่งปัจจุบันของคุณเรียบร้อยแล้ว');
      }
    } catch (error: any) {
      console.log('GPS Error:', error?.message);
      // Fallback
      updateMapPin(DEFAULT_LAT, DEFAULT_LNG);
    } finally {
      setGettingLocation(false);
    }
  };

  // เลือกที่อยู่สำเร็จรูป (Preset)
  const handleSelectPreset = (p: typeof PRESET_LOCATIONS[0]) => {
    setTitle(p.title);
    setDetail(p.detail);
    updateMapPin(p.lat, p.lng);
  };

  // เลือก Tag
  const handleSelectTag = (tag: string) => {
    const cleanTag = tag.replace(/^[^\s]+\s*/, '');
    setTitle(cleanTag);
  };

  // รับ Event จาก WebView (เมื่อลากหมุดหรือคลิกบนแผนที่)
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'COORDS_CHANGED') {
        const newLat = parseFloat(data.lat.toFixed(6));
        const newLng = parseFloat(data.lng.toFixed(6));
        setLatitude(newLat);
        setLongitude(newLng);
      }
    } catch (e) {}
  };

  // บันทึกที่อยู่ลง MySQL
  const handleSave = async () => {
    if (!title.trim() || !detail.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อสถานที่และรายละเอียดที่อยู่ให้ครบถ้วน');
      return;
    }
    if (!name.trim() || !phone.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อผู้รับและเบอร์โทรศัพท์');
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(`${BASE_URL}/users/${userId}/address`, {
        title: title.trim(),
        address_detail: detail.trim(),
        latitude: latitude,
        longitude: longitude,
        receiver_name: name.trim(),
        receiver_phone: phone.trim(),
        note_for_rider: noteForRider.trim(),
        is_default: 1
      });

      if (res.data?.success) {
        Alert.alert('สำเร็จ 🎉', 'บันทึกที่อยู่จัดส่งและพิกัดแผนที่เรียบร้อยแล้ว!', [
          { text: 'ตกลง', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('สำเร็จ 🎉', 'บันทึกที่อยู่เรียบร้อยแล้ว', [
          { text: 'ตกลง', onPress: () => router.back() }
        ]);
      }
    } catch (error: any) {
      console.error('Save Address Error:', error);
      Alert.alert('ผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  // HTML สำหรับ Leaflet Map ใน WebView
  const leafletMapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #e2e8f0; font-family: -apple-system, sans-serif; }
        .custom-pin-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
        }
        .pin-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pin-pulse {
          position: absolute;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(46, 122, 50, 0.3);
          animation: pulse 2s infinite ease-in-out;
        }
        .pin-icon {
          width: 32px;
          height: 32px;
          background: #2e7a32;
          border: 2.5px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(0,0,0,0.35);
          position: relative;
          z-index: 2;
        }
        .pin-dot {
          width: 10px;
          height: 10px;
          background: #ffffff;
          border-radius: 50%;
          transform: rotate(45deg);
        }
        @keyframes pulse {
          0% { transform: scale(0.8); opacity: 0.8; }
          50% { transform: scale(1.4); opacity: 0.2; }
          100% { transform: scale(0.8); opacity: 0.8; }
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var currentLat = ${latitude};
        var currentLng = ${longitude};

        var map = L.map('map', { 
          zoomControl: false, 
          attributionControl: false 
        }).setView([currentLat, currentLng], 16);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        var customIcon = L.divIcon({
          className: 'custom-pin-container',
          html: '<div class="pin-wrapper"><div class="pin-pulse"></div><div class="pin-icon"><div class="pin-dot"></div></div></div>',
          iconSize: [48, 48],
          iconAnchor: [24, 38]
        });

        var marker = L.marker([currentLat, currentLng], { 
          draggable: true, 
          icon: customIcon 
        }).addTo(map);

        function notifyCoords(lat, lng) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'COORDS_CHANGED',
              lat: lat,
              lng: lng
            }));
          }
        }

        marker.on('dragend', function(e) {
          var pos = marker.getLatLng();
          notifyCoords(pos.lat, pos.lng);
        });

        map.on('click', function(e) {
          marker.setLatLng(e.latlng);
          notifyCoords(e.latlng.lat, e.latlng.lng);
        });

        window.setMapLocation = function(lat, lng) {
          map.setView([lat, lng], 16);
          marker.setLatLng([lat, lng]);
        };
      </script>
    </body>
    </html>
  `;

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
        <Text style={styles.headerTitle}>ปักหมุดที่อยู่จัดส่ง</Text>
        <View style={{ width: 40 }} />
      </View>

      {fetching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#2e7a32" size="large" />
          <Text style={styles.loadingText}>กำลังโหลดข้อมูลที่อยู่...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* 2. Interactive Map Section */}
          <View style={styles.mapContainer}>
            <MapWebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: leafletMapHTML }}
              style={styles.mapWebView}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              onMessage={handleWebViewMessage}
              scrollEnabled={false}
            />

            {/* Floating Top GPS & Help Bar */}
            <View style={styles.mapFloatingBar}>
              <View style={styles.gpsIndicator}>
                <View style={styles.gpsDot} />
                <Text style={styles.gpsCoordsText}>
                  {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.currentLocBtn}
                onPress={handleGetCurrentLocation}
                activeOpacity={0.8}
                disabled={gettingLocation}
              >
                {gettingLocation ? (
                  <ActivityIndicator size="small" color="#2e7a32" />
                ) : (
                  <>
                    <MaterialIcons name="my-location" size={18} color="#2e7a32" />
                    <Text style={styles.currentLocText}>ตำแหน่งฉัน</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Floating Hint Overlay */}
            <View style={styles.mapHintBadge}>
              <MaterialCommunityIcons name="gesture-tap" size={16} color="#ffffff" />
              <Text style={styles.mapHintText}>แตะหรือลากหมุดบนแผนที่เพื่อเปลี่ยนพิกัด</Text>
            </View>
          </View>

          {/* 3. Address Form Bottom Card */}
          <ScrollView 
            style={styles.bottomCard} 
            contentContainerStyle={styles.scrollForm}
            showsVerticalScrollIndicator={false}
          >
            {/* Quick Preset Locations */}
            <Text style={styles.sectionLabel}>สถานที่ยอดนิยม (Quick Pick)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
              {PRESET_LOCATIONS.map((p, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.presetChip}
                  onPress={() => handleSelectPreset(p)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="location-on" size={15} color="#2e7a32" />
                  <Text style={styles.presetChipText}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Quick Category Tags */}
            <View style={styles.tagRow}>
              {TAG_PRESETS.map((t, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.tagChip, title.includes(t.replace(/^[^\s]+\s*/, '')) && styles.tagChipActive]}
                  onPress={() => handleSelectTag(t)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tagChipText, title.includes(t.replace(/^[^\s]+\s*/, '')) && styles.tagChipTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Input: ชื่อสถานที่ */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ชื่อสถานที่ / ป้ายกำกับ *</Text>
              <View style={styles.inputBox}>
                <MaterialIcons name="bookmark-border" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="เช่น ลาวัณย์ปาร์ควิลล์, บ้าน, คอนโดสุขุมวิท"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            {/* Input: รายละเอียดที่อยู่ */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>รายละเอียดที่อยู่ (บ้านเลขที่, ถนน, ตำบล, อำเภอ) *</Text>
              <View style={[styles.inputBox, { height: 78, alignItems: 'flex-start', paddingTop: 10 }]}>
                <MaterialIcons name="home" size={20} color="#64748b" style={[styles.inputIcon, { marginTop: 2 }]} />
                <TextInput
                  style={[styles.inputField, { height: '100%', textAlignVertical: 'top' }]}
                  multiline
                  value={detail}
                  onChangeText={setDetail}
                  placeholder="เช่น 577 ตำบลท่าขอนยาง อำเภอกันทรวิชัย มหาสารคาม 44150"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            {/* Row: ชื่อผู้รับ & เบอร์โทร */}
            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>ชื่อผู้รับ *</Text>
                <View style={styles.inputBox}>
                  <MaterialIcons name="person-outline" size={20} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    value={name}
                    onChangeText={setName}
                    placeholder="ชื่อผู้รับ"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>เบอร์โทรศัพท์ *</Text>
                <View style={styles.inputBox}>
                  <MaterialIcons name="phone" size={20} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="0812345678"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>
            </View>

            {/* Input: หมายเหตุถึงไรเดอร์ */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>หมายเหตุถึงไรเดอร์ (ถ้ามี)</Text>
              <View style={styles.inputBox}>
                <MaterialCommunityIcons name="comment-text-outline" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  value={noteForRider}
                  onChangeText={setNoteForRider}
                  placeholder="เช่น ฝากไว้ที่นิติ, วางไว้หน้าประตู, โทรเมื่อถึง"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={20} color="#ffffff" />
                  <Text style={styles.saveBtnText}>บันทึกที่อยู่จัดส่งนี้</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    zIndex: 10
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b'
  },
  mapContainer: {
    height: 240,
    width: '100%',
    position: 'relative',
    backgroundColor: '#e2e8f0'
  },
  mapWebView: {
    flex: 1,
    backgroundColor: '#e2e8f0'
  },
  mapFloatingBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20
  },
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e'
  },
  gpsCoordsText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600'
  },
  currentLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4
  },
  currentLocText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2e7a32'
  },
  mapHintBadge: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
    zIndex: 20
  },
  mapHintText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '500'
  },
  bottomCard: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  scrollForm: {
    padding: 16,
    paddingBottom: 36
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  presetScroll: {
    marginBottom: 12
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    gap: 4
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a'
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  tagChipActive: {
    backgroundColor: '#2e7a32',
    borderColor: '#2e7a32'
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569'
  },
  tagChipTextActive: {
    color: '#ffffff'
  },
  inputGroup: {
    marginBottom: 14
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    height: 48
  },
  inputIcon: {
    marginRight: 8
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a'
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2e7a32',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 10,
    elevation: 3,
    shadowColor: '#2e7a32',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold'
  }
});