import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, 
  Image, Alert, Modal, Dimensions, Linking 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { BASE_URL, SERVER_URL } from '../../constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

export default function OrderDetailsScreen() {
  const getImageUrl = (imgUrl?: string) => {
    if (!imgUrl) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
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

  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [currentShopId, setCurrentShopId] = useState<string | null>(null);

  const fetchOrderDetails = async () => {
    try {
      const shopId = await AsyncStorage.getItem('shop_id');
      if (shopId) setCurrentShopId(shopId);
      const url = shopId ? `${BASE_URL}/orders/${orderId}?shop_id=${shopId}` : `${BASE_URL}/orders/${orderId}`;
      const res = await axios.get(url);
      if (res.data?.success) {
        setOrder(res.data.data || res.data.order);
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถดึงข้อมูลคำสั่งซื้อได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
      const interval = setInterval(fetchOrderDetails, 8000);
      return () => clearInterval(interval);
    }
  }, [orderId]);

  const handleUpdateStatus = (newStatus: string) => {
    const statusLabels: Record<string, string> = {
      preparing: 'กำลังเตรียมสินค้า',
      ready: 'สินค้าพร้อมส่ง (รอไรเดอร์)',
      shipped: 'ส่งมอบให้ไรเดอร์แล้ว'
    };

    Alert.alert('ยืนยัน', `ต้องการเปลี่ยนสถานะออเดอร์เป็น "${statusLabels[newStatus] || newStatus}" ใช่หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน',
        onPress: async () => {
          try {
            const shopId = await AsyncStorage.getItem('shop_id');
            await axios.put(`${BASE_URL}/orders/${orderId}/status`, {
              order_status: newStatus,
              shop_id: shopId
            });
            Alert.alert('สำเร็จ', 'อัปเดตสถานะเรียบร้อยแล้ว');
            fetchOrderDetails();
          } catch (error) {
            console.error('Update status error:', error);
            Alert.alert('ผิดพลาด', 'ไม่สามารถเปลี่ยนสถานะได้');
          }
        }
      }
    ]);
  };

  const handleCallPhone = (phone?: string, name?: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert('แจ้งเตือน', `ไม่พบเบอร์โทรศัพท์ ${name || ''}`);
    }
  };

  const formatThaiDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const cleanStr = String(dateStr).replace(' ', 'T');
    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('th-TH', { 
      day: 'numeric', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    }) + ' น.';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2e7a32" />
        <Text style={{ marginTop: 10, color: '#64748b' }}>กำลังโหลดข้อมูลคำสั่งซื้อ...</Text>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={{ fontSize: 16, color: '#64748b' }}>ไม่พบข้อมูลคำสั่งซื้อ</Text>
        <TouchableOpacity style={styles.backBtnFallback} onPress={() => router.back()}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>กลับหน้ารายการ</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
      case 'paid':
      case 'preparing':
        return { text: 'กำลังจัดเตรียม', bg: '#e0f2fe', color: '#0284c7', icon: 'restaurant' };
      case 'ready':
        return { text: 'พร้อมส่ง (รอไรเดอร์)', bg: '#ede9fe', color: '#7c3aed', icon: 'inventory' };
      case 'delivering':
        return { text: 'ไรเดอร์กำลังนำส่ง', bg: '#dcfce7', color: '#15803d', icon: 'two-wheeler' };
      case 'delivered':
        return { text: 'จัดส่งถึงลูกค้าแล้ว', bg: '#dbeafe', color: '#1d4ed8', icon: 'check-circle' };
      case 'shipped':
        return { text: 'จัดส่งแล้ว', bg: '#dcfce7', color: '#15803d', icon: 'local-shipping' };
      case 'completed':
        return { text: 'สำเร็จสมบูรณ์', bg: '#f0fdf4', color: '#16a34a', icon: 'verified' };
      case 'cancelled':
        return { text: 'ยกเลิกแล้ว', bg: '#fee2e2', color: '#dc2626', icon: 'cancel' };
      default:
        return { text: status, bg: '#f1f5f9', color: '#64748b', icon: 'info' };
    }
  };

  const statusInfo = getStatusBadge(order.order_status);

  // Status timeline steps (เริ่มต้นที่กำลังเตรียม อัตโนมัติเมื่อสั่งซื้อ)
  const steps = [
    { key: 'preparing', label: 'กำลังเตรียม', active: true },
    { key: 'ready', label: 'พร้อมส่ง', active: ['ready', 'delivering', 'delivered', 'completed', 'shipped'].includes(order.order_status) },
    { key: 'delivering', label: 'ไรเดอร์รับของ', active: ['delivering', 'delivered', 'completed', 'shipped'].includes(order.order_status) },
    { key: 'delivered', label: 'ส่งถึงลูกค้า', active: ['delivered', 'completed'].includes(order.order_status) },
    { key: 'completed', label: 'สำเร็จ', active: order.order_status === 'completed' }
  ];

  // คัดกรองสินค้าเฉพาะของร้านนี้เท่านั้น
  const myItems = (order.items || []).filter((item: any) => {
    if (!currentShopId) return true;
    const itemShopId = String(item.product_shop_id || item.shop_id || '');
    return itemShopId === String(currentShopId);
  });
  const itemsToRender = myItems.length > 0 ? myItems : (order.items || []);
  const mySubtotal = itemsToRender.reduce((sum: number, it: any) => sum + (Number(it.price || 0) * (it.quantity || 1)), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>รายละเอียดคำสั่งซื้อ #{order.order_id}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.orderIdText}>คำสั่งซื้อ #{order.order_id}</Text>
              <Text style={styles.dateText}>{formatThaiDate(order.created_at)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <MaterialIcons name={statusInfo.icon as any} size={16} color={statusInfo.color} style={{ marginRight: 4 }} />
              <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.text}</Text>
            </View>
          </View>

          {/* Workflow progress bar */}
          <View style={styles.timelineWrapper}>
            <View style={styles.timelineStepsRow}>
              {steps.map((st, idx) => (
                <View key={idx} style={styles.stepCol}>
                  <View style={[styles.stepCircle, st.active && styles.stepCircleActive]}>
                    <Ionicons 
                      name={st.active ? "checkmark" : "ellipse"} 
                      size={st.active ? 12 : 8} 
                      color={st.active ? "#fff" : "#cbd5e1"} 
                    />
                  </View>
                  <Text style={[styles.stepText, st.active && styles.stepTextActive]} numberOfLines={1}>
                    {st.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ข้อมูลไรเดอร์ & หลักฐานรูปถ่าย (Rider & Proof Photos) */}
        {order.delivery_type !== 'pickup' && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>ข้อมูลการจัดส่ง & ไรเดอร์</Text>
              {order.rider_name && (
                <View style={styles.badgeSmallGreen}>
                  <Text style={styles.badgeSmallGreenText}>มีไรเดอร์รับงานแล้ว</Text>
                </View>
              )}
            </View>

            {order.rider_name ? (
              <View style={styles.riderBox}>
                <View style={styles.riderAvatar}>
                  <Text style={{ fontSize: 24 }}>🛵</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.riderNameText}>{order.rider_name}</Text>
                  <Text style={styles.riderSubText}>ทะเบียน: {order.rider_vehicle_plate || 'มอเตอร์ไซค์รับจ้าง'}</Text>
                  <Text style={styles.riderPhoneText}>โทร: {order.rider_phone || '-'}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.callCircleBtn}
                  onPress={() => handleCallPhone(order.rider_phone, 'ไรเดอร์')}
                >
                  <Ionicons name="call" size={20} color="#16a34a" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.noRiderNotice}>
                <Ionicons name="time-outline" size={20} color="#d97706" />
                <Text style={styles.noRiderText}>
                  {order.order_status === 'ready' ? 'ระบบกำลังจับคู่ไรเดอร์ที่ใกล้ที่สุด...' : 'จะทำการค้นหาไรเดอร์เมื่อคุณกดพร้อมส่ง'}
                </Text>
              </View>
            )}

            {/* รูปถ่ายยืนยันการรับสินค้าจากร้านค้า (Pickup Proof Photo) */}
            {order.pickup_proof_image && (
              <View style={styles.proofCard}>
                <View style={styles.proofHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="camera" size={18} color="#16a34a" />
                    <Text style={styles.proofTitle}>รูปถ่ายยืนยันตอนรับสินค้าหน้าร้าน</Text>
                  </View>
                  <Text style={styles.proofTimeText}>{formatThaiDate(order.pickup_at)}</Text>
                </View>
                <TouchableOpacity 
                  activeOpacity={0.9} 
                  onPress={() => setPreviewImage(getImageUrl(order.pickup_proof_image))}
                  style={styles.proofImageWrapper}
                >
                  <Image 
                    source={{ uri: getImageUrl(order.pickup_proof_image) }} 
                    style={styles.proofThumbImg} 
                    resizeMode="cover" 
                  />
                  <View style={styles.proofExpandBadge}>
                    <Ionicons name="expand" size={14} color="#fff" />
                    <Text style={styles.proofExpandText}>ดูรูปขนาดเต็ม</Text>
                  </View>
                </TouchableOpacity>
                <Text style={styles.proofDescText}>
                  ✓ ไรเดอร์ถ่ายรูปตรวจนับสินค้าหน้าร้านและยืนยันรับของแล้ว
                </Text>
              </View>
            )}

            {/* รูปถ่ายยืนยันการจัดส่งถึงลูกค้า (Delivery Proof Photo) */}
            {(order.delivery_proof_image || order.proof_image) && (
              <View style={[styles.proofCard, { borderColor: '#bfdbfe', backgroundColor: '#eff6ff' }]}>
                <View style={styles.proofHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="checkmark-done-circle" size={18} color="#2563eb" />
                    <Text style={[styles.proofTitle, { color: '#1e40af' }]}>รูปถ่ายยืนยันส่งมอบถึงลูกค้า</Text>
                  </View>
                  <Text style={styles.proofTimeText}>{formatThaiDate(order.delivery_completed_at || order.delivered_at)}</Text>
                </View>
                <TouchableOpacity 
                  activeOpacity={0.9} 
                  onPress={() => setPreviewImage(getImageUrl(order.delivery_proof_image || order.proof_image))}
                  style={styles.proofImageWrapper}
                >
                  <Image 
                    source={{ uri: getImageUrl(order.delivery_proof_image || order.proof_image) }} 
                    style={styles.proofThumbImg} 
                    resizeMode="cover" 
                  />
                  <View style={[styles.proofExpandBadge, { backgroundColor: 'rgba(37, 99, 235, 0.75)' }]}>
                    <Ionicons name="expand" size={14} color="#fff" />
                    <Text style={styles.proofExpandText}>ดูรูปขนาดเต็ม</Text>
                  </View>
                </TouchableOpacity>
                <Text style={[styles.proofDescText, { color: '#1e40af' }]}>
                  ✓ ไรเดอร์ส่งมอบสินค้าถึงมือลูกค้าเรียบร้อยแล้ว
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ข้อมูลลูกค้า (Customer Info) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>ข้อมูลลูกค้า & ที่อยู่จัดส่ง</Text>
          <View style={styles.customerBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.customerNameText}>{order.customer_name || order.receiver_name || 'ลูกค้า'}</Text>
              <Text style={styles.customerPhoneText}>เบอร์โทร: {order.customer_phone || order.receiver_phone || '-'}</Text>
              <Text style={styles.customerAddressText}>
                {order.delivery_type === 'pickup' ? '📍 ลูกค้าเลือกรับสินค้าเองที่หน้าร้าน' : `📍 ${order.shipping_address || 'ไม่ระบุที่อยู่'}`}
              </Text>
              {order.note_for_rider && (
                <Text style={styles.noteText}>📝 โน้ตเพิ่มเติม: {order.note_for_rider}</Text>
              )}
            </View>
            {(order.customer_phone || order.receiver_phone) && (
              <TouchableOpacity 
                style={styles.callCircleBtn}
                onPress={() => handleCallPhone(order.customer_phone || order.receiver_phone, 'ลูกค้า')}
              >
                <Ionicons name="call" size={20} color="#2563eb" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* รายการสินค้า (Items) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>รายการสินค้า ({itemsToRender.length} รายการ)</Text>
          {itemsToRender.map((item: any, index: number) => (
            <View key={index} style={styles.itemRow}>
              <Image source={{ uri: getImageUrl(item.product_image) }} style={styles.itemImage} />
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.product_name || item.name}</Text>
                <Text style={styles.itemQty}>จำนวน: x{item.quantity}</Text>
                {item.note && <Text style={styles.itemNote}>*{item.note}</Text>}
              </View>
              <Text style={styles.itemPrice}>฿{(Number(item.price) * item.quantity).toFixed(2)}</Text>
            </View>
          ))}

          {/* สรุปยอดเงิน */}
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>ยอดรวมสินค้า</Text>
              <Text style={styles.summaryValue}>฿{mySubtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>หักส่วนลด</Text>
              <Text style={[styles.summaryValue, { color: '#ef4444' }]}>-฿{Number(order.discount || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>ค่าธรรมเนียมระบบ (GP {order.gp_percent || 15}%)</Text>
              <Text style={styles.summaryValue}>฿{((mySubtotal - Number(order.discount || 0)) * (order.gp_percent || 15) / 100).toFixed(2)}</Text>
            </View>
            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryTotalLabel}>ยอดที่ร้านค้าจะได้รับสุทธิ</Text>
              <Text style={styles.summaryTotalValue}>฿{((mySubtotal - Number(order.discount || 0)) * (1 - (order.gp_percent || 15) / 100)).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* รีวิวจากลูกค้า */}
        {order.order_status === 'completed' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>รีวิวจากลูกค้า</Text>
            {order.review ? (
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <MaterialIcons 
                      key={star} 
                      name="star" 
                      size={18} 
                      color={star <= order.review.rating ? '#f59e0b' : '#e2e8f0'} 
                    />
                  ))}
                </View>
                <Text style={{ fontSize: 14, color: '#334155', fontStyle: 'italic' }}>"{order.review.comment}"</Text>
              </View>
            ) : (
              <Text style={{ fontSize: 14, color: '#94a3b8', fontStyle: 'italic', marginTop: 8 }}>ไม่มีรีวิวจากลูกค้า</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons ด้านล่าง */}
      <View style={styles.bottomBar}>
        {/* Chat with Customer button */}
        <TouchableOpacity 
          style={styles.chatBtn}
          onPress={async () => {
            const shopId = await AsyncStorage.getItem('shop_id');
            router.push({ 
              pathname: '/order-chat' as any, 
              params: { order_id: order.order_id, role: 'seller', target: 'buyer', user_id: shopId || order.shop_id } 
            });
          }}
        >
          <Ionicons name="chatbubble-ellipses" size={18} color="#2e7a32" />
          <Text style={styles.chatBtnText}>แชทลูกค้า</Text>
        </TouchableOpacity>

        {/* Chat with Rider button (if assigned) */}
        {order.rider_name && (
          <TouchableOpacity 
            style={[styles.chatBtn, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}
            onPress={async () => {
              const shopId = await AsyncStorage.getItem('shop_id');
              router.push({ 
                pathname: '/order-chat' as any, 
                params: { order_id: order.order_id, role: 'seller', target: 'rider', user_id: shopId || order.shop_id } 
              });
            }}
          >
            <Ionicons name="bicycle" size={18} color="#16a34a" />
            <Text style={[styles.chatBtnText, { color: '#16a34a' }]}>แชทไรเดอร์</Text>
          </TouchableOpacity>
        )}

        {/* Dynamic action based on status (เริ่มต้นที่กำลังเตรียม และมีปุ่มพร้อมส่ง) */}
        {['pending', 'paid', 'preparing'].includes(order.order_status) && (
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#7c3aed' }]}
            onPress={() => handleUpdateStatus('ready')}
          >
            <Ionicons name="checkmark-done" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnText}>เตรียมเสร็จแล้ว (พร้อมส่ง)</Text>
          </TouchableOpacity>
        )}

        {order.order_status === 'ready' && (
          <View style={styles.statusNoticeBox}>
            <Ionicons name="hourglass-outline" size={18} color="#7c3aed" />
            <Text style={styles.statusNoticeText}>
              {order.rider_name ? 'ไรเดอร์กำลังเดินทางมารับสินค้า' : 'รอไรเดอร์รับงาน'}
            </Text>
          </View>
        )}

        {['delivering', 'shipped'].includes(order.order_status) && (
          <View style={[styles.statusNoticeBox, { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' }]}>
            <Ionicons name="bicycle" size={20} color="#15803d" />
            <Text style={[styles.statusNoticeText, { color: '#15803d' }]}>
              ไรเดอร์กำลังนำส่งให้ลูกค้า
            </Text>
          </View>
        )}

        {order.order_status === 'delivered' && (
          <View style={[styles.statusNoticeBox, { backgroundColor: '#dbeafe', borderColor: '#bfdbfe' }]}>
            <Ionicons name="checkmark-circle" size={20} color="#1d4ed8" />
            <Text style={[styles.statusNoticeText, { color: '#1d4ed8' }]}>
              จัดส่งถึงลูกค้าแล้ว (รอลูกค้ายืนยัน)
            </Text>
          </View>
        )}
      </View>

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
  centerContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderIdText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  
  timelineWrapper: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  timelineStepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepCol: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepCircleActive: {
    backgroundColor: '#16a34a',
  },
  stepText: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
  },
  stepTextActive: {
    color: '#0f172a',
    fontWeight: 'bold',
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  badgeSmallGreen: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeSmallGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },

  riderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderNameText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  riderSubText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  riderPhoneText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
    marginTop: 2,
  },
  callCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
  },

  noRiderNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fefce8',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fef08a',
  },
  noRiderText: {
    fontSize: 13,
    color: '#854d0e',
    flex: 1,
  },

  proofCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  proofHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  proofTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#166534',
  },
  proofTimeText: {
    fontSize: 11,
    color: '#64748b',
  },
  proofImageWrapper: {
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
    marginBottom: 6,
  },
  proofThumbImg: {
    width: '100%',
    height: '100%',
  },
  proofExpandBadge: {
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
  proofExpandText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  proofDescText: {
    fontSize: 12,
    color: '#166534',
    marginTop: 4,
  },

  customerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  customerNameText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  customerPhoneText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  customerAddressText: {
    fontSize: 13,
    color: '#334155',
    marginTop: 4,
    lineHeight: 18,
  },
  noteText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    fontStyle: 'italic',
  },

  itemRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'center',
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  itemQty: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  itemNote: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 2,
    fontStyle: 'italic',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },

  summaryContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 13,
    color: '#0f172a',
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  summaryTotalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  summaryTotalValue: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#2e7a32',
  },

  bottomBar: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 10,
    alignItems: 'center',
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 6,
  },
  chatBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2e7a32',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#2e7a32',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusNoticeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    gap: 6,
  },
  statusNoticeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6d28d9',
  },

  backBtnFallback: {
    marginTop: 20,
    backgroundColor: '#2e7a32',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },

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
