import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, Image, TouchableOpacity, 
  ScrollView, ActivityIndicator, Linking, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { BASE_URL } from '../constants/api';

export default function OrderTrackingScreen() {
  const params = useLocalSearchParams();
  const orderId = params.order_id ? Number(params.order_id) : 24;

  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<any>(null);

  useEffect(() => {
    fetchTrackingData();
  }, [orderId]);

  const fetchTrackingData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BASE_URL}/orders/${orderId}/tracking`);
      if (res.data?.success) {
        setTracking(res.data.tracking);
      } else {
        setTracking(null);
      }
    } catch (e) {
      console.log('Error fetching tracking from MySQL:', e);
      setTracking(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCall = () => {
    const phone = tracking?.rider?.phone || '0812345678';
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('โทรติดต่อ', `เบอร์โทรไรเดอร์: ${phone}`);
    });
  };

  const handleChat = () => {
    Alert.alert('แชทกับคนขับ', 'ระบบแชทสดกำลังเปิดให้บริการกับไรเดอร์ของคุณ');
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

        <Text style={styles.headerTitle}>ติดตามสถานะคำสั่งซื้อ</Text>

        <TouchableOpacity 
          style={styles.helpBtn}
          onPress={() => Alert.alert('ศูนย์ช่วยเหลือ', 'หากมีปัญหาในการจัดส่ง ติดต่อฝ่ายบริการลูกค้า 02-123-4567')}
          activeOpacity={0.7}
        >
          <MaterialIcons name="help-outline" size={24} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#16a34a" size="large" />
          <Text style={{ marginTop: 12, color: '#64748b' }}>กำลังเชื่อมต่อตำแหน่งไรเดอร์จากฐานข้อมูล...</Text>
        </View>
      ) : !tracking ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={54} color="#94a3b8" />
          <Text style={{ marginTop: 14, fontSize: 16, fontWeight: 'bold', color: '#0f172a' }}>
            ไม่พบข้อมูลการจัดส่งคำสั่งซื้อ #{orderId}
          </Text>
          <Text style={{ marginTop: 6, fontSize: 13, color: '#64748b', textAlign: 'center', marginHorizontal: 32 }}>
            คำสั่งซื้ออาจยังไม่ได้รับการยืนยัน หรือไม่มีอยู่ในฐานข้อมูล
          </Text>
          <TouchableOpacity
            style={{ marginTop: 20, backgroundColor: '#16a34a', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 14 }}
            onPress={() => router.back()}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>กลับหน้ารายการสั่งซื้อ</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 2. Realistic Delivery Route Map Section */}
          <View style={styles.mapContainer}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800' }} 
              style={styles.mapImage}
            />
            {/* Map Overlay Route Graphics */}
            <View style={styles.mapOverlay}>
              {/* Rider Pin Marker */}
              <View style={styles.riderPinWrapper}>
                <View style={styles.etaTooltip}>
                  <Text style={styles.etaTooltipText}>{tracking?.eta_minutes || '5 นาที'}</Text>
                </View>
                <View style={styles.riderMarkerCircle}>
                  <MaterialIcons name="two-wheeler" size={24} color="#fff" />
                </View>
              </View>
            </View>
          </View>

          {/* 3. Status Stepper Card */}
          <View style={styles.statusSheetCard}>
            <View style={styles.statusHeaderRow}>
              <View>
                <Text style={styles.statusMainTitle}>{tracking?.status_title || 'คนขับกำลังไปรับสินค้า'}</Text>
                <Text style={styles.refCodeText}>เลขอ้างอิง: {tracking?.ref_code || '#SD-99210'}</Text>
              </View>
              <View style={styles.etaBox}>
                <Text style={styles.etaSubText}>เวลาที่คาดถึง</Text>
                <Text style={styles.etaMainText}>{tracking?.eta_text || '12:45 น.'}</Text>
              </View>
            </View>

            {/* Stepper Timeline */}
            <View style={styles.timelineContainer}>
              {tracking?.steps?.map((step: any, index: number) => {
                const isLast = index === tracking.steps.length - 1;
                return (
                  <View key={step.id} style={styles.timelineStepRow}>
                    {/* Left Icon and Line */}
                    <View style={styles.timelineLeftCol}>
                      <View style={[
                        styles.stepIconCircle,
                        step.completed && styles.stepIconCompleted,
                        step.current && styles.stepIconCurrent,
                      ]}>
                        <MaterialIcons 
                          name={step.icon as any} 
                          size={16} 
                          color={step.completed ? '#fff' : step.current ? '#16a34a' : '#94a3b8'} 
                        />
                      </View>
                      {!isLast && <View style={[styles.timelineLine, step.completed && styles.timelineLineDone]} />}
                    </View>

                    {/* Right Content */}
                    <View style={styles.timelineRightCol}>
                      <Text style={[styles.stepTitle, (step.completed || step.current) && styles.stepTitleActive]}>
                        {step.title}
                      </Text>
                      <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 4. Rider Profile Card */}
          <View style={styles.riderCard}>
            <View style={styles.riderInfoRow}>
              <Image 
                source={{ uri: tracking?.rider?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200' }} 
                style={styles.riderAvatar} 
              />
              <View style={styles.riderDetails}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.riderName}>{tracking?.rider?.name || 'สมชาย ใจดี'}</Text>
                  <View style={styles.riderRatingBadge}>
                    <MaterialIcons name="star" size={14} color="#f59e0b" />
                    <Text style={styles.riderRatingText}>{tracking?.rider?.rating || '4.9'}</Text>
                  </View>
                </View>
                <Text style={styles.riderVehicle}>{tracking?.rider?.vehicle || 'ทะเบียน กข-1234 (รถจักรยานยนต์)'}</Text>
                <Text style={styles.riderTag}>{tracking?.rider?.tag || 'ฉีดวัคซีนแล้ว 3 เข็ม'}</Text>
              </View>
            </View>

            {/* Rider Action Buttons */}
            <View style={styles.riderActionRow}>
              <TouchableOpacity style={styles.actionCircleBtn} onPress={handleCall}>
                <MaterialIcons name="call" size={20} color="#16a34a" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCircleBtn} onPress={handleChat}>
                <MaterialIcons name="chat" size={20} color="#16a34a" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.reviewNavBtn}
                onPress={() => router.push({
                  pathname: '/review',
                  params: {
                    order_id: orderId,
                    shop_name: tracking?.shop_name,
                    product_name: tracking?.items?.[0]?.product_name || 'อาหารจานโปรด'
                  }
                })}
              >
                <MaterialIcons name="star" size={18} color="#f59e0b" />
                <Text style={styles.reviewNavText}>ให้คะแนนร้าน</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* 5. Bottom Navigation Bar */}
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
          <Text style={[styles.navText, { color: '#16a34a', fontWeight: 'bold' }]}>รายการสั่งซื้อ</Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0'
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#0f172a' },
  helpBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  scrollContent: { paddingBottom: 20 },
  mapContainer: {
    width: '100%',
    height: 240,
    backgroundColor: '#e2e8f0',
    position: 'relative'
  },
  mapImage: { width: '100%', height: '100%', opacity: 0.8 },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center'
  },
  riderPinWrapper: { alignItems: 'center' },
  etaTooltip: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    elevation: 3
  },
  etaTooltipText: { fontSize: 11, fontWeight: 'bold', color: '#16a34a' },
  riderMarkerCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 4
  },
  statusSheetCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 3
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9'
  },
  statusMainTitle: { fontSize: 18, fontWeight: 'bold', color: '#16a34a' },
  refCodeText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  etaBox: { alignItems: 'flex-end' },
  etaSubText: { fontSize: 11, color: '#94a3b8' },
  etaMainText: { fontSize: 17, fontWeight: 'bold', color: '#0f172a' },
  timelineContainer: { marginTop: 16 },
  timelineStepRow: { flexDirection: 'row', minHeight: 56 },
  timelineLeftCol: { alignItems: 'center', width: 32 },
  stepIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  stepIconCompleted: { backgroundColor: '#16a34a' },
  stepIconCurrent: { backgroundColor: '#e8f5e9', borderWidth: 1.5, borderColor: '#16a34a' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#e2e8f0', marginVertical: 2 },
  timelineLineDone: { backgroundColor: '#16a34a' },
  timelineRightCol: { flex: 1, marginLeft: 12, justifyContent: 'flex-start', paddingBottom: 12 },
  stepTitle: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  stepTitleActive: { color: '#0f172a', fontWeight: 'bold' },
  stepSubtitle: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  riderCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2
  },
  riderInfoRow: { flexDirection: 'row', alignItems: 'center' },
  riderAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#e2e8f0' },
  riderDetails: { flex: 1, marginLeft: 12 },
  riderName: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  riderRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2
  },
  riderRatingText: { fontSize: 11, fontWeight: 'bold', color: '#d97706' },
  riderVehicle: { fontSize: 12, color: '#475569', marginTop: 2 },
  riderTag: { fontSize: 11, color: '#16a34a', fontWeight: '600', marginTop: 2 },
  riderActionRow: { flexDirection: 'row', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: '#f1f5f9' },
  actionCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  reviewNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 22,
    gap: 6
  },
  reviewNavText: { fontSize: 13, fontWeight: 'bold', color: '#b45309' },
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
