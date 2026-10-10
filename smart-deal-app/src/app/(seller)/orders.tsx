import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../../constants/api';

export default function SellerOrdersScreen() {
  const getImageUrl = (imgUrl?: string) => {
    if (!imgUrl) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
    if (imgUrl.startsWith('data:') || imgUrl.startsWith('http://') || imgUrl.startsWith('https://') || imgUrl.startsWith('file://')) {
      return imgUrl;
    }
    return `${BASE_URL.replace('/api', '')}${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;
  };

  const [activeTab, setActiveTab] = useState('preparing'); // preparing, ready, history
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOrders = async () => {
    try {
      const shopId = await AsyncStorage.getItem('shop_id');
      if (!shopId) return;

      const res = await axios.get(`${BASE_URL}/shops/${shopId}/orders`);
      if (res.data?.success) {
        setOrders(res.data.orders);
      }
    } catch (error) {
      console.error('Error fetching seller orders:', error);
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

  const handleUpdateStatus = (orderId: number, newStatus: string) => {
    const statusLabels: Record<string, string> = {
      preparing: 'กำลังเตรียมสินค้า',
      ready: 'สินค้าพร้อมส่ง (รอไรเดอร์)',
      delivering: 'ส่งมอบให้ไรเดอร์แล้ว'
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
            fetchOrders();
          } catch (error) {
            console.error('Update status error:', error);
            Alert.alert('ผิดพลาด', 'ไม่สามารถเปลี่ยนสถานะได้');
          }
        }
      }
    ]);
  };

  const filteredOrders = orders.filter(o => {
    const searchMatch = 
      o.order_id.toString().includes(searchQuery) ||
      (o.full_name && o.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()));
      
    if (!searchMatch) return false;

    if (activeTab === 'preparing') return ['pending', 'paid', 'preparing'].includes(o.order_status);
    if (activeTab === 'ready') return o.order_status === 'ready';
    if (activeTab === 'history') return ['delivering', 'delivered', 'shipped', 'completed', 'cancelled'].includes(o.order_status);
    return false;
  });

  const getOrderStatusBadge = (status: string) => {
    switch(status) {
      case 'pending':
      case 'paid':
        return { text: 'รอรับออเดอร์', bg: '#fef3c7', color: '#d97706' };
      case 'preparing':
        return { text: 'กำลังเตรียม', bg: '#e0f2fe', color: '#0284c7' };
      case 'ready':
        return { text: 'พร้อมส่ง', bg: '#ede9fe', color: '#7c3aed' };
      case 'delivering':
        return { text: 'ไรเดอร์กำลังส่ง 🛵', bg: '#dcfce7', color: '#15803d' };
      case 'delivered':
        return { text: 'ส่งถึงลูกค้าแล้ว 📦', bg: '#dbeafe', color: '#1d4ed8' };
      case 'completed':
        return { text: 'สำเร็จ ✅', bg: '#f0fdf4', color: '#16a34a' };
      case 'cancelled':
        return { text: 'ยกเลิก', bg: '#fee2e2', color: '#dc2626' };
      default:
        return { text: status, bg: '#f1f5f9', color: '#64748b' };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>จัดการคำสั่งซื้อของร้านค้า</Text>
        <TouchableOpacity style={styles.notiBtn} onPress={() => fetchOrders()}>
          <Ionicons name="refresh" size={20} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {[
          { key: 'preparing', label: 'กำลังเตรียม' },
          { key: 'ready', label: 'พร้อมส่ง' },
          { key: 'history', label: 'ประวัติ/จัดส่ง' }
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          
          let countText = '';
          if (tab.key === 'preparing') {
            const count = orders.filter(o => ['pending', 'paid', 'preparing'].includes(o.order_status)).length;
            if (count > 0) countText = ` (${count})`;
          } else if (tab.key === 'ready') {
            const count = orders.filter(o => o.order_status === 'ready').length;
            if (count > 0) countText = ` (${count})`;
          }

          return (
            <TouchableOpacity 
              key={tab.key} 
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}{countText}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94a3b8" />
        <TextInput 
          style={styles.searchInput}
          placeholder="ค้นหาหมายเลขคำสั่งซื้อหรือชื่อลูกค้า"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView 
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#2e7a32" style={{ marginTop: 40 }} />
        ) : filteredOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="receipt-long" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>ไม่มีคำสั่งซื้อในสถานะนี้</Text>
          </View>
        ) : (
          filteredOrders.map((order) => {
            const items = order.items || [];
            const itemsText = items.map((i: any) => `${i.product_name || i.name} x${i.quantity}`).join(', ');
            const badge = getOrderStatusBadge(order.order_status);

            return (
              <View key={order.order_id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderHeaderLeft}>
                    <Image source={{ uri: items[0]?.product_image ? getImageUrl(items[0]?.product_image) : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500' }} style={styles.customerAvatar} />
                    <View>
                      <Text style={styles.orderId}>คำสั่งซื้อ #{order.order_id}</Text>
                      <Text style={styles.customerName}>ลูกค้า: {order.customer_name || order.full_name || 'ลูกค้าทั่วไป'}</Text>
                    </View>
                  </View>
                  <View style={[styles.customBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.customBadgeText, { color: badge.color }]}>{badge.text}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Rider Info Strip */}
                {['preparing', 'ready', 'delivering', 'delivered', 'shipped', 'completed'].includes(order.order_status) && order.rider_name && (
                  <View style={styles.riderStrip}>
                    <MaterialIcons name="two-wheeler" size={16} color="#16a34a" />
                    <Text style={styles.riderStripText}>
                      ไรเดอร์: <Text style={{ fontWeight: 'bold' }}>{order.rider_name}</Text> {order.rider_phone ? `(${order.rider_phone})` : ''}
                    </Text>
                    {order.pickup_proof_image && (
                      <View style={styles.photoPill}>
                        <Ionicons name="camera" size={12} color="#15803d" />
                        <Text style={styles.photoPillText}>มีรูปยืนยันรับของ</Text>
                      </View>
                    )}
                  </View>
                )}

                <Text style={styles.itemsText} numberOfLines={2}>
                  รายการ: {itemsText || 'รายการอาหาร/สินค้า'}
                </Text>

                <View style={styles.footerRow}>
                  <Text style={styles.totalPrice}>฿{Number(order.subtotal || order.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  <View style={styles.actionRow}>
                    {activeTab === 'preparing' && (
                      <>
                        {['pending', 'paid'].includes(order.order_status) ? (
                          <TouchableOpacity 
                            style={[styles.primaryBtn, { backgroundColor: '#f59e0b' }]}
                            onPress={() => handleUpdateStatus(order.order_id, 'preparing')}
                          >
                            <Text style={styles.primaryBtnText}>รับออเดอร์</Text>
                          </TouchableOpacity>
                        ) : order.order_status === 'preparing' ? (
                          <TouchableOpacity 
                            style={[styles.primaryBtn, { backgroundColor: '#7c3aed' }]}
                            onPress={() => handleUpdateStatus(order.order_id, 'ready')}
                          >
                            <Text style={styles.primaryBtnText}>พร้อมส่ง</Text>
                          </TouchableOpacity>
                        ) : null}
                      </>
                    )}
                    {['preparing', 'ready', 'delivering', 'delivered', 'shipped', 'completed'].includes(order.order_status) && (
                      <TouchableOpacity 
                        style={[styles.secondaryBtn, { marginRight: 8, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1, flexDirection: 'row', alignItems: 'center' }]}
                        onPress={async () => {
                          const shopId = await AsyncStorage.getItem('shop_id');
                          router.push({ pathname: '/order-chat' as any, params: { order_id: order.order_id, role: 'seller', user_id: shopId || order.shop_id } });
                        }}
                      >
                        <Ionicons name="chatbubbles" size={14} color="#16a34a" style={{ marginRight: 4 }} />
                        <Text style={[styles.secondaryBtnText, { color: '#16a34a', fontWeight: '700' }]}>แชท</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      style={styles.secondaryBtn}
                      onPress={() => router.push({ pathname: '/(seller)/order-details' as any, params: { orderId: order.order_id } })}
                    >
                      <Text style={styles.secondaryBtnText}>รายละเอียด</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
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
  menuBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#0f172a' },
  notiBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: { backgroundColor: '#2e7a32' },
  tabText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  tabTextActive: { color: '#fff', fontWeight: 'bold' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, paddingVertical: 10, marginLeft: 8, fontSize: 13, color: '#0f172a' },
  listContainer: { paddingHorizontal: 12, paddingBottom: 24 },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { marginTop: 12, fontSize: 15, color: '#94a3b8' },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  customerAvatar: { width: 42, height: 42, borderRadius: 8, backgroundColor: '#f1f5f9', marginRight: 10 },
  orderId: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  customerName: { fontSize: 12, color: '#64748b', marginTop: 2 },
  customBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  customBadgeText: { fontSize: 11, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 10 },
  riderStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dcfce7',
    gap: 6,
  },
  riderStripText: { fontSize: 12, color: '#166534', flex: 1 },
  photoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  photoPillText: { fontSize: 10, color: '#15803d', fontWeight: '700' },
  itemsText: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 12 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalPrice: { fontSize: 16, fontWeight: 'bold', color: '#2e7a32' },
  actionRow: { flexDirection: 'row', gap: 6 },
  primaryBtn: { backgroundColor: '#2e7a32', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  secondaryBtn: { backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  secondaryBtnText: { color: '#475569', fontSize: 13, fontWeight: '600' }
});
