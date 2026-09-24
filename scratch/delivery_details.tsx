import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function DeliveryRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [status, setStatus] = useState('ongoing'); // picked_up, ongoing, completed

  const customerName = 'คุณสมชาย ใจดี';
  const customerPhone = '081-234-5678';
  const deliveryAddress = '123/45 คอนโดสมาร์ท เพลส ชั้น 12 ห้อง 1205 ถนนพญาไท เขตราชเทวี กรุงเทพฯ 10400';

  const renderStatusIcons = () => {
    return (
      <View style={styles.statusIconsContainer}>
        <View style={styles.statusIconItem}>
          <View style={[styles.iconCircle, status !== 'picked_up' && { backgroundColor: '#2e7d32' }]}>
            <MaterialCommunityIcons name="package-variant" size={20} color="#fff" />
          </View>
          <Text style={styles.statusIconText}>รับของแล้ว</Text>
        </View>

        <View style={styles.statusIconItem}>
          <View style={[styles.iconCircle, status === 'ongoing' ? { backgroundColor: '#2e7d32' } : { backgroundColor: '#e0e0e0' }]}>
            <MaterialCommunityIcons name="truck-delivery" size={20} color={status === 'ongoing' ? '#fff' : '#999'} />
          </View>
          <Text style={styles.statusIconText}>กำลังเดินทาง</Text>
        </View>

        <View style={styles.statusIconItem}>
          <View style={[styles.iconCircle, { backgroundColor: '#e0e0e0' }]}>
            <Ionicons name="checkmark" size={20} color="#999" />
          </View>
          <Text style={styles.statusIconText}>ส่งสำเร็จ</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{status === 'ongoing' ? 'อัปเดตสถานะการส่ง' : 'เส้นทางการส่ง'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Map View */}
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: 13.7563,
              longitude: 100.5018,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            <Marker coordinate={{ latitude: 13.7563, longitude: 100.5018 }} />
            <Marker coordinate={{ latitude: 13.7663, longitude: 100.5118 }} />
          </MapView>
          
          <View style={styles.mapOverlay}>
             <View style={styles.distanceBadge}>
               <Ionicons name="location" size={14} color="#2e7d32" />
               <Text style={styles.distanceText}>ห่างจากจุดหมาย 1.2 กม.</Text>
             </View>
          </View>
        </View>

        {renderStatusIcons()}

        <View style={styles.cardContainer}>
          <View style={styles.statusHeaderRow}>
            <Text style={styles.cardTitle}>สถานะปัจจุบัน</Text>
            <View style={styles.timeBadge}>
              <Text style={styles.timeBadgeText}>ในเวลา</Text>
            </View>
          </View>

          <Text style={styles.currentStatusText}>กำลังดำเนินการส่ง</Text>

          <View style={styles.timeline}>
            <View style={styles.timelineItem}>
              <View style={styles.timelineIconActive}>
                <View style={styles.timelineIconInner} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>ออกจากคลังสินค้า</Text>
                <Text style={styles.timelineTime}>วันนี้, 10:30 น.</Text>
              </View>
            </View>
            
            <View style={styles.timelineLine} />

            <View style={styles.timelineItem}>
              <MaterialCommunityIcons name="truck-delivery" size={24} color="#2e7d32" style={{ marginLeft: -2 }} />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, { color: '#2e7d32' }]}>พัสดุกำลังมุ่งหน้าไปยังจุดหมาย</Text>
                <Text style={styles.timelineTime}>คาดว่าจะถึงใน 15 นาที</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardContainer}>
          <Text style={styles.cardTitle}>รายละเอียดการส่ง</Text>

          <View style={styles.customerRow}>
            <Image 
              source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }} 
              style={styles.customerAvatar} 
            />
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{customerName}</Text>
              <Text style={styles.customerPhone}>ผู้รับ • {customerPhone}</Text>
            </View>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="chatbubble" size={20} color="#2e7d32" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="call" size={20} color="#2e7d32" />
            </TouchableOpacity>
          </View>

          <View style={styles.addressBox}>
            <View style={styles.addressIconContainer}>
              <Ionicons name="location" size={20} color="#2e7d32" />
            </View>
            <View style={styles.addressInfo}>
              <Text style={styles.addressTitle}>ที่อยู่จัดส่ง</Text>
              <Text style={styles.addressText}>{deliveryAddress}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.footerSpace} />
      </ScrollView>

      <View style={styles.bottomActionContainer}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => router.push(`/proof-of-delivery/${id}` as any)}
        >
          <Ionicons name="person" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.primaryButtonText}>ยืนยันการมาถึงจุดหมาย</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryButton}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#2e7d32" style={{ marginRight: 8 }} />
          <Text style={styles.secondaryButtonText}>อัปเดตสถานะส่งสำเร็จ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#f8f9fa',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  mapContainer: {
    height: 250,
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginLeft: 4,
  },
  statusIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statusIconItem: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIconText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  cardContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    color: '#666',
  },
  timeBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeBadgeText: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: 'bold',
  },
  currentStatusText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 24,
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineIconActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2e7d32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineIconInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2e7d32',
  },
  timelineLine: {
    width: 2,
    height: 30,
    backgroundColor: '#e0e0e0',
    marginLeft: 9,
    marginVertical: 4,
  },
  timelineContent: {
    marginLeft: 16,
    flex: 1,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 13,
    color: '#999',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  customerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 13,
    color: '#666',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  addressBox: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  addressIconContainer: {
    marginRight: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  footerSpace: {
    height: 40,
  },
  bottomActionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#2e7d32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#e8f5e9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
  },
  secondaryButtonText: {
    color: '#2e7d32',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
