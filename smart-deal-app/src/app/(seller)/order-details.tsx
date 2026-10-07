import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import { BASE_URL } from '../../constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function OrderDetailsScreen() {
  const getImageUrl = (imgUrl?: string) => {
    if (!imgUrl) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
    if (imgUrl.startsWith('data:') || imgUrl.startsWith('http://') || imgUrl.startsWith('https://') || imgUrl.startsWith('file://')) {
      return imgUrl;
    }
    return `${BASE_URL.replace('/api', '')}${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;
  };

const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrderDetails = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/orders/${orderId}`);
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
    }
  }, [orderId]);

  const handleUpdateStatus = (newStatus: string) => {
    Alert.alert('ยืนยัน', `ต้องการเปลี่ยนสถานะออเดอร์เป็น ${newStatus} ใช่หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน',
        onPress: async () => {
          try {
            await axios.put(`${BASE_URL}/orders/${orderId}/status`, {
              order_status: newStatus
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

  if (loading) {
      return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2e7a32" />
        <Text style={{ marginTop: 10, color: '#64748b' }}>กำลังโหลดข้อมูล...</Text>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={48} color="#cbd5e1" />
        <Text style={{ marginTop: 10, color: '#64748b' }}>ไม่พบข้อมูลคำสั่งซื้อ</Text>
        <TouchableOpacity style={styles.backBtnFallback} onPress={() => router.back()}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>กลับ</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const formatThaiDateTime = (dateStr: any) => {
    if (!dateStr || typeof dateStr === 'object' && Object.keys(dateStr).length === 0) return 'เมื่อสักครู่';
    try {
      const cleanStr = typeof dateStr === 'string' ? dateStr.replace(' ', 'T') : dateStr;
      const date = new Date(cleanStr);
      if (isNaN(date.getTime())) return 'เมื่อสักครู่';
      const thaiMonthsShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      return `${date.getDate()} ${thaiMonthsShort[date.getMonth()]} ${date.getFullYear() + 543} • ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } catch (e) {
      return 'เมื่อสักครู่';
    }
  };

  const getStatusDisplay = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pending' || s === 'paid') return { text: 'ใหม่', color: '#f59e0b', bg: '#fef3c7' };
    if (s === 'preparing') return { text: 'กำลังเตรียม', color: '#2563eb', bg: '#dbeafe' };
    if (s === 'ready') return { text: 'พร้อมส่ง', color: '#16a34a', bg: '#dcfce7' };
    if (s === 'delivering' || s === 'finding_rider') return { text: 'กำลังจัดส่ง', color: '#0284c7', bg: '#e0f2fe' };
    if (s === 'completed') return { text: 'สำเร็จ', color: '#15803d', bg: '#dcfce7' };
    if (s === 'cancelled') return { text: 'ยกเลิก', color: '#dc2626', bg: '#fee2e2' };
    return { text: status, color: '#64748b', bg: '#f1f5f9' };
  };

  const statusInfo = getStatusDisplay(order.order_status);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>รายละเอียดคำสั่งซื้อ</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* ส่วนหัว: รหัสคำสั่งซื้อ */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.orderIdText}>คำสั่งซื้อ #SD-{order.order_id}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.text}</Text>
            </View>
          </View>
          <Text style={styles.dateText}>{formatThaiDateTime(order.created_at)}</Text>
        </View>

        {/* ข้อมูลลูกค้า */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>ข้อมูลลูกค้า</Text>
          <View style={styles.infoRow}>
            <MaterialIcons name="person" size={20} color="#64748b" />
            <Text style={styles.infoText}>{order.full_name || order.customer_name || 'ลูกค้าทั่วไป'}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="phone" size={20} color="#64748b" />
            <Text style={styles.infoText}>{order.phone || order.customer_phone || 'ไม่ระบุเบอร์โทร'}</Text>
          </View>
        </View>

        {/* รายการอาหาร */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>รายการอาหาร</Text>
          {(order.items || []).map((item: any, idx: number) => (
            <View key={idx} style={styles.itemRow}>
              <Image source={{ uri: getImageUrl(item.product_image || item.image_url) }} style={styles.itemImage} />
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                <Text style={styles.itemQty}>จำนวน: x{item.quantity}</Text>
                {item.note ? (
                  <Text style={styles.itemNote}>หมายเหตุ: {item.note}</Text>
                ) : null}
              </View>
              <Text style={styles.itemPrice}>฿{(item.price * item.quantity).toLocaleString()}</Text>
            </View>
          ))}
        </View>

        {/* สรุปยอดเงิน */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>สรุปยอดเงินสำหรับร้านค้า</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>ยอดรวมค่าอาหาร</Text>
            <Text style={styles.summaryValue}>฿{Number(order.subtotal || order.total_amount).toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>ส่วนลดร้านค้า</Text>
            <Text style={styles.summaryValue}>- ฿{Number(order.discount || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>หักค่าธรรมเนียมแอป (GP {order.gp_percent || 15}%)</Text>
            <Text style={styles.summaryValue}>- ฿{((Number(order.subtotal || order.total_amount) - Number(order.discount || 0)) * (order.gp_percent || 15) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>ยอดสุทธิที่ร้านค้าได้รับ</Text>
            <Text style={styles.summaryTotalValue}>฿{((Number(order.subtotal || order.total_amount) - Number(order.discount || 0)) * (1 - (order.gp_percent || 15) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>
        </View>

        {/* ข้อมูลจัดส่ง */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>การจัดส่ง</Text>
          <View style={styles.infoRow}>
            <MaterialIcons name={order.delivery_type === 'pickup' ? "storefront" : "local-shipping"} size={20} color="#64748b" />
            <Text style={styles.infoText}>{order.delivery_type === 'pickup' ? 'รับเองที่ร้าน' : 'จัดส่งเดลิเวอรี'}</Text>
          </View>
          {order.delivery_type !== 'pickup' && ['preparing', 'ready', 'delivering', 'shipped', 'completed'].includes(order.order_status) && order.rider_name && (
            <View style={styles.infoRow}>
              <Ionicons name="bicycle" size={20} color="#64748b" />
              <Text style={styles.infoText}>ไรเดอร์: {order.rider_name} ({order.rider_phone})</Text>
            </View>
          )}
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
        <TouchableOpacity 
          style={styles.chatBtn}
          onPress={async () => {
            const shopId = await AsyncStorage.getItem('shop_id');
            router.push({ pathname: '/order-chat' as any, params: { order_id: order.order_id, role: 'seller', user_id: shopId } });
          }}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color="#2e7a32" />
          <Text style={styles.chatBtnText}>แชท</Text>
        </TouchableOpacity>

        {['pending', 'paid'].includes(order.order_status) && (
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => handleUpdateStatus('preparing')}
          >
            <Text style={styles.actionBtnText}>รับคำสั่งซื้อ (กำลังเตรียม)</Text>
          </TouchableOpacity>
        )}
        
        {order.order_status === 'preparing' && (
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => handleUpdateStatus('ready')}
          >
            <Text style={styles.actionBtnText}>พร้อมส่ง</Text>
          </TouchableOpacity>
        )}

        {order.order_status === 'ready' && (
          <TouchableOpacity 
            style={[styles.actionBtn, !order.rider_name && { backgroundColor: '#94a3b8' }]}
            onPress={() => {
              if (!order.rider_name) {
                Alert.alert('รอดำเนินการ', 'ยังไม่มีคนขับรับงานนี้ กรุณารอคนขับรับงานก่อนกดส่งมอบ');
                return;
              }
              handleUpdateStatus('shipped');
            }}
          >
            <Text style={styles.actionBtnText}>ส่งมอบให้ไรเดอร์แล้ว</Text>
          </TouchableOpacity>
        )}
      </View>
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
    fontSize: 18,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 14,
    color: '#64748b',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#334155',
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'center',
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  itemQty: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  itemNote: {
    fontSize: 13,
    color: '#ef4444',
    marginTop: 2,
    fontStyle: 'italic',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 14,
    color: '#0f172a',
  },
  summaryTotalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7a32',
  },
  bottomBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  chatBtnText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2e7a32',
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2e7a32',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  backBtnFallback: {
    marginTop: 20,
    backgroundColor: '#2e7a32',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  }
});
