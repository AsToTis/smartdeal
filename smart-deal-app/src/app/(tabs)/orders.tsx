import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  ActivityIndicator, 
  RefreshControl,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { BASE_URL } from '../../constants/api';
import { useCart } from '../../context/CartContext';

type TabType = 'all' | 'completed' | 'cancelled';

export default function OrdersScreen() {
  const { addToCart } = useCart();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // States for Report Issue
  const [issueModalVisible, setIssueModalVisible] = useState(false);
  const [issueTopic, setIssueTopic] = useState('');
  const [issueDetail, setIssueDetail] = useState('');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);

  const fetchOrders = async () => {
    try {
      let currentUserId = 2; // ค่าเริ่มต้น (สมชาย ใจดี)
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          if (user?.user_id) currentUserId = user.user_id;
        }
      } catch (e) {
        console.log('AsyncStorage read error', e);
      }

      const res = await axios.get(`${BASE_URL}/orders/user/${currentUserId}`);
      if (res.data && res.data.success) {
        setOrders(res.data.data || []);
      } else {
        setOrders([]);
      }
    } catch (error: any) {
      console.error('❌ Fetch orders error:', error?.message || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [])
  );

  // กรองตามแท็บ (ทั้งหมด, สำเร็จ, ยกเลิก)
  const filteredOrders = orders.filter((order) => {
    const status = (order.order_status || '').toLowerCase();
    if (activeTab === 'completed') {
      return status === 'completed';
    }
    if (activeTab === 'cancelled') {
      return status === 'cancelled';
    }
    // All tab shows everything
    return true;
  });

  // ฟังก์ชันแปลงวันที่เวลาแบบไทย เช่น 15 ต.ค. 2023 • 12:30
  const formatThaiDateTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const thaiMonthsShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const day = date.getDate();
    const month = thaiMonthsShort[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year} • ${hours}:${minutes}`;
  };

  // ฟังก์ชันหาชื่อกลุ่ม เดือน ปี เช่น ตุลาคม 2566
  const getMonthYearKey = (dateStr: string) => {
    if (!dateStr) return 'ล่าสุด';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'ล่าสุด';
    const thaiMonthsFull = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const month = thaiMonthsFull[date.getMonth()];
    const yearBE = date.getFullYear() + 543;
    return `${month} ${yearBE}`;
  };

  // จัดกลุ่มคำสั่งซื้อตาม เดือน ปี
  const groupedOrders: { [key: string]: any[] } = {};
  filteredOrders.forEach((order) => {
    const groupKey = getMonthYearKey(order.created_at);
    if (!groupedOrders[groupKey]) {
      groupedOrders[groupKey] = [];
    }
    groupedOrders[groupKey].push(order);
  });

  // ดึงข้อมูลสถานะ: สีจุด, ข้อความสถานะ
  const getStatusInfo = (status: string) => {
    const s = (status || '').toLowerCase();
    
    if (s === 'cancelled') {
      return { dotColor: '#ef4444', textColor: '#ef4444', text: 'ยกเลิก', isCancelled: true, isActive: false };
    }
    
    if (s === 'completed') {
      return { dotColor: '#16a34a', textColor: '#16a34a', text: 'สำเร็จ', isCancelled: false, isActive: false };
    }
    
    if (s === 'preparing') {
      return { dotColor: '#0ea5e9', textColor: '#0ea5e9', text: 'กำลังจัดเตรียมอาหาร', isCancelled: false, isActive: true };
    }
    
    if (s === 'delivering' || s === 'finding_rider' || s === 'heading_to_shop' || s === 'ready') {
      return { dotColor: '#2563eb', textColor: '#2563eb', text: 'กำลังจัดส่ง', isCancelled: false, isActive: true };
    }
    
    // pending หรือค่าเริ่มต้น
    return { dotColor: '#f59e0b', textColor: '#f59e0b', text: 'รอร้านค้ายืนยัน', isCancelled: false, isActive: true };
  };

  // รูปภาพสินค้าตัวแทน
  const getOrderImage = (order: any) => {
    if (order.display_image) return order.display_image;
    if (order.shop_image) return order.shop_image;
    if (order.items && order.items.length > 0 && order.items[0].product_image) {
      return order.items[0].product_image;
    }
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
  };

  // ฟังก์ชันสั่งซื้อซ้ำ
  const handleConfirmReceipt = (orderId: number) => {
    Alert.alert(
      'ยืนยันการรับสินค้า',
      'คุณได้รับสินค้าเรียบร้อยแล้วใช่หรือไม่? เงินจะถูกโอนไปยังร้านค้าทันที',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        { 
          text: 'ยืนยัน', 
          style: 'default',
          onPress: async () => {
            try {
              const res = await axios.put(`${BASE_URL}/orders/${orderId}/complete`);
              if (res.data?.success) {
                Alert.alert('สำเร็จ', 'ยืนยันการรับสินค้าเรียบร้อยแล้ว');
                setSelectedOrder(null);
                fetchOrders(); // Refresh orders
              } else {
                Alert.alert('ข้อผิดพลาด', res.data?.message || 'ไม่สามารถยืนยันได้');
              }
            } catch (e: any) {
              Alert.alert('ข้อผิดพลาด', e.response?.data?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
            }
          }
        }
      ]
    );
  };

  const handleReorder = (order: any) => {
    if (order.items && order.items.length > 0) {
      order.items.forEach((item: any) => {
        addToCart({
          product_id: item.product_id || 1,
          name: item.product_name || order.display_title || 'สินค้า',
          price: Number(item.price || 0),
          image_url: item.product_image || getOrderImage(order),
          shop_id: order.shop_id || 1
        }, item.quantity || 1);
      });
      setSelectedOrder(null);
      router.push('/cart');
    }
  };

  // ฟังก์ชันดาวน์โหลดใบเสร็จ e-Receipt
  const handleDownloadReceipt = async (order: any) => {
    try {
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .logo { font-size: 24px; font-weight: bold; color: #2e7a32; }
              .receipt-title { font-size: 18px; color: #666; margin-top: 5px; }
              .info-row { margin-bottom: 10px; font-size: 14px; }
              .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              .table th, .table td { border-bottom: 1px solid #ddd; padding: 10px; text-align: left; }
              .total-row { font-weight: bold; font-size: 16px; margin-top: 10px; }
              .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #999; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="logo">Smart Deal</div>
              <div class="receipt-title">e-Receipt / ใบเสร็จรับเงินอิเล็กทรอนิกส์</div>
            </div>
            <div class="info-row"><strong>Order ID:</strong> #${order.order_id}</div>
            <div class="info-row"><strong>Date:</strong> ${formatThaiDateTime(order.created_at)}</div>
            <div class="info-row"><strong>Shop:</strong> ${order.shop_name || 'ร้านค้าทั่วไป'}</div>
            <div class="info-row"><strong>Payment Method:</strong> ${order.payment_method === 'promptpay' ? 'PromptPay' : 'Cash'}</div>
            
            <table class="table">
              <thead>
                <tr>
                  <th>รายการ (Item)</th>
                  <th>จำนวน (Qty)</th>
                  <th>ราคา (Price)</th>
                </tr>
              </thead>
              <tbody>
                ${order.items?.map((item: any) => `
                  <tr>
                    <td>${item.product_name}</td>
                    <td>${item.quantity}</td>
                    <td>฿${item.price}</td>
                  </tr>
                `).join('') || ''}
              </tbody>
            </table>
            
            <div style="margin-top: 20px; text-align: right;">
              <div class="info-row">ค่าจัดส่ง (Delivery Fee): ฿${order.delivery_fee}</div>
              <div class="info-row">ส่วนลด (Discount): ฿${order.discount}</div>
              <div class="total-row">ยอดชำระสุทธิ (Total): ฿${order.total_amount}</div>
            </div>
            
            <div class="footer">
              ขอบคุณที่ใช้บริการ Smart Deal<br/>
              เอกสารนี้สร้างขึ้นโดยระบบอิเล็กทรอนิกส์
            </div>
          </body>
        </html>
      `;
      
      const { base64 } = await Print.printToFileAsync({ html: htmlContent, base64: true });
      
      // เขียนไฟล์ Base64 ลง DocumentDirectory โดยตรง เพื่อเลี่ยงปัญหา Permission ของโฟลเดอร์ Cache ใน Android
      const newUri = FileSystem.documentDirectory + `Receipt_${order.order_id}.pdf`;
      await FileSystem.writeAsStringAsync(newUri, base64 || '', {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      await Sharing.shareAsync(newUri, { 
        UTI: '.pdf', 
        mimeType: 'application/pdf',
        dialogTitle: 'บันทึก/แชร์ ใบเสร็จอิเล็กทรอนิกส์'
      });
    } catch (error) {
      console.error('PDF error', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถสร้างใบเสร็จได้');
    }
  };

  // ฟังก์ชันแจ้งปัญหาคำสั่งซื้อ
  const handleSubmitIssue = async () => {
    if (!issueTopic) {
      Alert.alert('แจ้งเตือน', 'กรุณาเลือกหัวข้อปัญหา');
      return;
    }
    
    setIsSubmittingIssue(true);
    try {
      let currentUserId = 2; 
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        if (user?.user_id) currentUserId = user.user_id;
      }
      
      const res = await axios.post(`${BASE_URL}/orders/${selectedOrder.order_id}/issues`, {
        user_id: currentUserId,
        issue_topic: issueTopic,
        issue_detail: issueDetail
      });
      
      if (res.data.success) {
        Alert.alert('สำเร็จ', res.data.message);
        setIssueModalVisible(false);
        setIssueTopic('');
        setIssueDetail('');
      } else {
        Alert.alert('ข้อผิดพลาด', res.data.message || 'ไม่สามารถส่งเรื่องได้');
      }
    } catch (error: any) {
      Alert.alert('ข้อผิดพลาด', error.response?.data?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      {/* 1. Header ด้านบน */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ประวัติการสั่งซื้อ</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 2. แท็บกรอง: ทั้งหมด | สำเร็จ | ยกเลิก */}
      <View style={styles.tabBarContainer}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'all' && styles.tabItemActive]}
          onPress={() => setActiveTab('all')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            ทั้งหมด
          </Text>
          {activeTab === 'all' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'completed' && styles.tabItemActive]}
          onPress={() => setActiveTab('completed')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
            สำเร็จ
          </Text>
          {activeTab === 'completed' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'cancelled' && styles.tabItemActive]}
          onPress={() => setActiveTab('cancelled')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'cancelled' && styles.tabTextActive]}>
            ยกเลิก
          </Text>
          {activeTab === 'cancelled' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>
      </View>

      {/* 3. รายการคำสั่งซื้อ */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>กำลังดึงประวัติการสั่งซื้อ...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchOrders();
              }}
              colors={['#16a34a']}
            />
          }
        >
          {Object.keys(groupedOrders).length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <MaterialIcons name="receipt-long" size={48} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>ไม่มีประวัติคำสั่งซื้อในหมวดนี้</Text>
              <Text style={styles.emptySubtitle}>เมื่อคุณสั่งอาหาร รายการประวัติจะแสดงที่นี่</Text>
              <TouchableOpacity 
                style={styles.shopNowBtn}
                onPress={() => router.replace('/(tabs)')}
                activeOpacity={0.8}
              >
                <Text style={styles.shopNowText}>เลือกซื้ออาหารดีลพิเศษ</Text>
              </TouchableOpacity>
            </View>
          ) : (
            Object.keys(groupedOrders).map((groupKey) => (
              <View key={groupKey} style={styles.groupSection}>
                {/* ชื่อเดือน ปี เช่น ตุลาคม 2566 */}
                <Text style={styles.groupTitle}>{groupKey}</Text>

                {groupedOrders[groupKey].map((order) => {
                  const statusInfo = getStatusInfo(order.order_status);
                  const imageUrl = getOrderImage(order);
                  const price = Number(order.total_amount || 0);

                  return (
                    <TouchableOpacity
                      key={order.order_id}
                      style={styles.orderCard}
                      onPress={() => setSelectedOrder(order)}
                      activeOpacity={0.85}
                    >
                      {/* รูปภาพกลมด้านซ้าย */}
                      <View style={styles.avatarWrapper}>
                        <Image 
                          source={{ uri: imageUrl }} 
                          style={[styles.avatarImage, statusInfo.isCancelled && styles.avatarCancelled]} 
                        />
                      </View>

                      {/* ข้อมูลตรงกลาง */}
                      <View style={styles.orderInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.orderTitle, { flex: 1 }]} numberOfLines={1}>
                            {order.display_title || order.shop_name || 'ร้านอาหาร'}
                          </Text>
                          {order.order_type === 'auction' && (
                            <View style={styles.auctionBadge}>
                              <Text style={styles.auctionBadgeText}>🏷️ ประมูลสำเร็จ</Text>
                            </View>
                          )}
                        </View>
                        
                        {/* จุดสถานะ + ข้อความสถานะ */}
                        <View style={styles.statusRow}>
                          <View style={[styles.statusDot, { backgroundColor: statusInfo.dotColor }]} />
                          <Text style={[styles.statusLabel, { color: statusInfo.textColor }]}>
                            {statusInfo.text}
                          </Text>
                        </View>

                        {/* วันที่และเวลา */}
                        <Text style={styles.dateTimeText}>
                          {formatThaiDateTime(order.created_at)}
                        </Text>
                      </View>

                      {/* ยอดเงินด้านขวา */}
                      <View style={styles.priceContainer}>
                        <Text 
                          style={[
                            styles.priceText,
                            statusInfo.isCancelled && styles.priceCancelledText
                          ]}
                        >
                          ฿{Math.round(price)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* 4. Modal รายละเอียดคำสั่งซื้อแบบเต็ม */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={!!selectedOrder}
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />
            
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>รายละเอียดคำสั่งซื้อ #{selectedOrder?.order_id}</Text>
                <Text style={styles.modalTime}>{formatThaiDateTime(selectedOrder?.created_at)}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.closeBtn}>
                <MaterialIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* ร้านค้า & สถานะ */}
              <View style={styles.modalSectionCard}>
                <View style={styles.modalShopRow}>
                  <Image source={{ uri: getOrderImage(selectedOrder || {}) }} style={styles.modalShopImg} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.modalShopName}>{selectedOrder?.shop_name || 'ร้านค้า'}</Text>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusInfo(selectedOrder?.order_status).dotColor }]} />
                      <Text style={[styles.statusLabel, { color: getStatusInfo(selectedOrder?.order_status).textColor }]}>
                        {getStatusInfo(selectedOrder?.order_status).text}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* รายการสินค้า */}
              <View style={styles.modalSectionCard}>
                <Text style={styles.modalSectionHeading}>รายการสินค้า</Text>
                {selectedOrder?.items && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((item: any, idx: number) => (
                    <View key={idx} style={styles.modalItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalItemName}>{item.product_name || 'สินค้า'}</Text>
                        <Text style={styles.modalItemQty}>จำนวน x{item.quantity || 1}</Text>
                      </View>
                      <Text style={styles.modalItemPrice}>฿{Number((item.price || 0) * (item.quantity || 1)).toFixed(2)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: '#888', fontSize: 13 }}>สินค้าจากคำสั่งซื้อ #{selectedOrder?.order_id}</Text>
                )}
              </View>

              {/* ข้อมูลจัดส่ง */}
              <View style={styles.modalSectionCard}>
                <Text style={styles.modalSectionHeading}>การจัดส่ง</Text>
                <Text style={styles.modalDetailText}>ประเภท: {selectedOrder?.delivery_type_text || selectedOrder?.delivery_type || 'จัดส่งถึงบ้าน'}</Text>
                <Text style={styles.modalDetailText}>ที่อยู่: {selectedOrder?.shipping_address || 'ไม่ระบุ'}</Text>
                {selectedOrder?.receiver_name && (
                  <Text style={styles.modalDetailText}>ผู้รับ: {selectedOrder.receiver_name} ({selectedOrder.receiver_phone})</Text>
                )}
                {selectedOrder?.rider_name && (
                  <View style={styles.riderDetailBox}>
                    <Ionicons name="bicycle" size={18} color="#16a34a" />
                    <Text style={styles.riderDetailText}>ไรเดอร์: {selectedOrder.rider_name} ({selectedOrder.rider_phone})</Text>
                  </View>
                )}
              </View>

              {/* สรุปยอดเงิน */}
              <View style={styles.modalSummaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>ยอดรวมสินค้า</Text>
                  <Text style={styles.summaryVal}>฿{Number(selectedOrder?.subtotal || selectedOrder?.total_amount || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>ค่าจัดส่ง</Text>
                  <Text style={styles.summaryVal}>฿{Number(selectedOrder?.delivery_fee || 0).toFixed(2)}</Text>
                </View>
                <View style={[styles.summaryRow, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderColor: '#f1f5f9' }]}>
                  <Text style={styles.totalLabelText}>ยอดชำระสุทธิ</Text>
                  <Text style={styles.totalValText}>฿{Number(selectedOrder?.total_amount || 0).toFixed(2)}</Text>
                </View>
              </View>
            </ScrollView>

            {/* ปุ่ม Actions ด้านล่าง */}
            <View style={[styles.modalActionRow, { flexDirection: 'column', gap: 8 }]}>
{/* ปุ่มแชท (Order Chat System) */}
              {['preparing', 'shipped', 'completed'].includes(selectedOrder?.order_status) && (
                <View style={{ marginBottom: 8 }}>
                  <TouchableOpacity 
                    style={[styles.trackNavBtn, { flex: 0, width: '100%', backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}
                    onPress={() => {
                      const id = selectedOrder?.order_id;
                      setSelectedOrder(null);
                      router.push({ pathname: '/order-chat' as any, params: { order_id: id, role: 'buyer', user_id: 2 } });
                    }}
                  >
                    <Ionicons name="chatbubble-ellipses" size={16} color="#0f172a" />
                    <Text style={[styles.trackNavBtnText, { color: '#0f172a', marginLeft: 6 }]}>แชทกับร้านค้า</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Row 1: ติดตามสถานะ / รีวิว + สั่งซ้ำ */}
              <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                {/* ปุ่มยืนยันการรับสินค้า (Escrow) */}
                {['paid', 'shipped', 'pending'].includes(selectedOrder?.order_status) && (
                  <TouchableOpacity 
                    style={[styles.trackNavBtn, { backgroundColor: '#16a34a', borderColor: '#16a34a', flex: 1.5 }]}
                    onPress={() => handleConfirmReceipt(selectedOrder?.order_id)}
                  >
                    <MaterialIcons name="check-circle" size={16} color="#fff" />
                    <Text style={[styles.trackNavBtnText, { color: '#fff' }]}>ได้รับสินค้าแล้ว</Text>
                  </TouchableOpacity>
                )}

                {/* ปุ่มติดตามสถานะ (เฉพาะออเดอร์ที่กำลังดำเนินการ) */}
                {getStatusInfo(selectedOrder?.order_status).isActive && (
                  <TouchableOpacity 
                    style={styles.trackNavBtn}
                    onPress={() => {
                      const id = selectedOrder?.order_id;
                      setSelectedOrder(null);
                      router.push({ pathname: '/tracking' as any, params: { id } });
                    }}
                  >
                    <MaterialIcons name="navigation" size={16} color="#16a34a" />
                    <Text style={styles.trackNavBtnText}>ติดตามสถานะ</Text>
                  </TouchableOpacity>
                )}

                {/* ปุ่มรีวิว (เฉพาะออเดอร์ที่สำเร็จแล้ว) */}
                {!getStatusInfo(selectedOrder?.order_status).isActive && !getStatusInfo(selectedOrder?.order_status).isCancelled && (
                  <TouchableOpacity 
                    style={styles.reviewOrderBtn}
                    onPress={() => {
                      const o = selectedOrder;
                      setSelectedOrder(null);
                      router.push({
                        pathname: '/review' as any,
                        params: {
                          order_id: o?.order_id,
                          shop_name: o?.shop_name,
                          product_name: o?.items?.[0]?.product_name || o?.display_title || 'อาหารจานโปรด',
                          order_date: formatThaiDateTime(o?.created_at)
                        }
                      });
                    }}
                  >
                    <MaterialIcons name="star" size={16} color="#d97706" />
                    <Text style={styles.reviewOrderBtnText}>รีวิวอาหาร</Text>
                  </TouchableOpacity>
                )}

                {/* ปุ่มสั่งซ้ำ */}
                {selectedOrder?.items && selectedOrder.items.length > 0 && (
                  <TouchableOpacity 
                    style={styles.reorderBtn}
                    onPress={() => handleReorder(selectedOrder)}
                  >
                    <MaterialIcons name="replay" size={16} color="#fff" />
                    <Text style={styles.reorderBtnText}>สั่งซ้ำ</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Row 2: ใบเสร็จ + แจ้งปัญหา (เฉพาะออเดอร์ที่สำเร็จแล้ว) */}
              {!getStatusInfo(selectedOrder?.order_status).isActive && !getStatusInfo(selectedOrder?.order_status).isCancelled && (
                <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                  <TouchableOpacity 
                    style={[styles.reviewOrderBtn, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                    onPress={() => handleDownloadReceipt(selectedOrder)}
                  >
                    <MaterialIcons name="receipt" size={16} color="#2563eb" />
                    <Text style={[styles.reviewOrderBtnText, {color: '#2563eb'}]}>ใบเสร็จ</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.reviewOrderBtn, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}
                    onPress={() => setIssueModalVisible(true)}
                  >
                    <MaterialIcons name="report-problem" size={16} color="#ef4444" />
                    <Text style={[styles.reviewOrderBtnText, {color: '#ef4444'}]}>แจ้งปัญหา</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

          </View>
        </View>
      </Modal>

      {/* Modal แจ้งปัญหา */}
      <Modal
        visible={issueModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIssueModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.issueModalContainer}>
            <View style={styles.issueModalHeader}>
              <Text style={styles.issueModalTitle}>แจ้งปัญหาคำสั่งซื้อ #{selectedOrder?.order_id}</Text>
              <TouchableOpacity onPress={() => setIssueModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.issueForm}>
              <Text style={styles.issueLabel}>หัวข้อปัญหา <Text style={{color: 'red'}}>*</Text></Text>
              
              <View style={styles.topicOptions}>
                {['ได้รับอาหารไม่ครบ', 'อาหารเสียหาย', 'ไรเดอร์บริการไม่ดี', 'รอนานผิดปกติ', 'อื่นๆ'].map(topic => (
                  <TouchableOpacity 
                    key={topic}
                    style={[styles.topicBtn, issueTopic === topic && styles.topicBtnActive]}
                    onPress={() => setIssueTopic(topic)}
                  >
                    <Text style={[styles.topicBtnText, issueTopic === topic && styles.topicBtnTextActive]}>{topic}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.issueLabel, {marginTop: 20}]}>รายละเอียดเพิ่มเติม</Text>
              <TextInput
                style={styles.issueInput}
                multiline
                numberOfLines={4}
                placeholder="ระบุรายละเอียดปัญหาที่พบ เพื่อให้ทีมงานตรวจสอบ..."
                value={issueDetail}
                onChangeText={setIssueDetail}
                textAlignVertical="top"
              />

              <TouchableOpacity 
                style={[styles.submitIssueBtn, isSubmittingIssue && {opacity: 0.7}]}
                onPress={handleSubmitIssue}
                disabled={isSubmittingIssue}
              >
                {isSubmittingIssue ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitIssueBtnText}>ส่งข้อมูล</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#f6f8f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f6f8f6',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
  },
  tabBarContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f6f8f6',
  },
  tabItem: {
    marginRight: 24,
    paddingVertical: 10,
    position: 'relative',
  },
  tabItemActive: {},
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#2e7a32',
    fontWeight: 'bold',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#2e7a32',
    borderRadius: 2,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  groupSection: {
    marginTop: 14,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    marginHorizontal: 18,
    marginBottom: 10,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1.5,
  },
  avatarWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarCancelled: {
    opacity: 0.6,
  },
  orderInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  orderTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 2,
  },
  auctionBadge: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  auctionBadgeText: {
    fontSize: 10,
    color: '#ea580c',
    fontWeight: 'bold',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateTimeText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  priceCancelledText: {
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
  },
  shopNowBtn: {
    backgroundColor: '#2e7a32',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  shopNowText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalTime: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  modalSectionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  modalShopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalShopImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  modalShopName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalSectionHeading: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 8,
  },
  modalItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  modalItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  modalItemQty: {
    fontSize: 11,
    color: '#64748b',
  },
  modalItemPrice: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalDetailText: {
    fontSize: 12,
    color: '#475569',
    marginVertical: 2,
  },
  riderDetailBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  riderDetailText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  modalSummaryBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  totalLabelText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  totalValText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  reorderBtn: {
    flex: 1,
    backgroundColor: '#2e7a32',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  reorderBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  trackNavBtn: {
    flex: 1.2,
    backgroundColor: '#e8f5e9',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  trackNavBtnText: {
    color: '#16a34a',
    fontSize: 13,
    fontWeight: 'bold',
  },
  reviewOrderBtn: {
    flex: 1.1,
    backgroundColor: '#fffbeb',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  reviewOrderBtnText: {
    color: '#d97706',
    fontSize: 13,
    fontWeight: 'bold',
  },
  closeSheetBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeSheetBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  issueModalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  issueModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  issueModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  issueForm: {
    marginTop: 10,
  },
  issueLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
  },
  topicOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  topicBtnActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  topicBtnText: {
    fontSize: 13,
    color: '#64748b',
  },
  topicBtnTextActive: {
    color: '#ef4444',
    fontWeight: 'bold',
  },
  issueInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#0f172a',
    marginTop: 8,
    marginBottom: 24,
  },
  submitIssueBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitIssueBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});