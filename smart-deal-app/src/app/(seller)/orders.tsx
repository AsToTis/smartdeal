import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../../constants/api';

export default function SellerOrdersScreen() {
  const [activeTab, setActiveTab] = useState('new'); // new, preparing, ready
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
    Alert.alert('ยืนยัน', `ต้องการเปลี่ยนสถานะออเดอร์เป็น ${newStatus} ใช่หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน',
        onPress: async () => {
          try {
            await axios.put(`${BASE_URL}/orders/${orderId}/status`, {
              order_status: newStatus
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
      (o.full_name && o.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
      
    if (!searchMatch) return false;

    // pending/paid -> new, preparing -> preparing, ready -> ready
    if (activeTab === 'new') return ['pending', 'paid'].includes(o.order_status);
    if (activeTab === 'preparing') return o.order_status === 'preparing';
    if (activeTab === 'ready') return o.order_status === 'ready';
    return false;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuBtn}>
          <MaterialIcons name="menu" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>จัดการคำสั่งซื้อ</Text>
        <TouchableOpacity style={styles.notiBtn}>
          <MaterialIcons name="notifications" size={20} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {['new', 'preparing', 'ready'].map((tab) => {
          const labels: any = { new: 'ใหม่', preparing: 'กำลังเตรียม', ready: 'พร้อมส่ง' };
          const isActive = activeTab === tab;
          
          let countText = '';
          if (tab === 'new') {
            const count = orders.filter(o => ['pending', 'paid'].includes(o.order_status)).length;
            if (count > 0) countText = ` (${count})`;
          }

          return (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {labels[tab]}{countText}
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
            const itemsText = items.map((i: any) => `${i.product_name} x${i.quantity}`).join(', ');

            return (
              <View key={order.order_id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderHeaderLeft}>
                    <Image source={{ uri: items[0]?.product_image || 'https://via.placeholder.com/50' }} style={styles.customerAvatar} />
                    <View>
                      <Text style={styles.orderId}>คำสั่งซื้อ #SD-{order.order_id}</Text>
                      <Text style={styles.customerName}>ลูกค้า: {order.full_name || 'ลูกค้าทั่วไป'}</Text>
                    </View>
                  </View>
                  {activeTab === 'new' ? (
                    <View style={styles.badgeNew}><Text style={styles.badgeTextNew}>ใหม่</Text></View>
                  ) : activeTab === 'preparing' ? (
                    <View style={styles.badgePrep}><Text style={styles.badgeTextPrep}>กำลังเตรียม</Text></View>
                  ) : (
                    <View style={styles.badgeReady}><Text style={styles.badgeTextReady}>พร้อมส่ง</Text></View>
                  )}
                </View>

                <View style={styles.divider} />

                <Text style={styles.itemsText} numberOfLines={2}>
                  รายการ: {itemsText}
                </Text>

                <View style={styles.footerRow}>
                  <Text style={styles.totalPrice}>฿{Number(order.total_amount).toLocaleString()}</Text>
                  <View style={styles.actionRow}>
                    {activeTab === 'new' && (
                      <TouchableOpacity 
                        style={styles.primaryBtn}
                        onPress={() => handleUpdateStatus(order.order_id, 'preparing')}
                      >
                        <Text style={styles.primaryBtnText}>รับคำสั่งซื้อ</Text>
                      </TouchableOpacity>
                    )}
                    {activeTab === 'preparing' && (
                      <TouchableOpacity 
                        style={styles.primaryBtn}
                        onPress={() => handleUpdateStatus(order.order_id, 'ready')}
                      >
                        <Text style={styles.primaryBtnText}>พร้อมส่ง</Text>
                      </TouchableOpacity>
                    )}
                    {activeTab === 'ready' && (
                      <TouchableOpacity 
                        style={styles.primaryBtn}
                        onPress={() => handleUpdateStatus(order.order_id, 'delivering')}
                      >
                        <Text style={styles.primaryBtnText}>ส่งมอบแล้ว</Text>
                      </TouchableOpacity>
                    )}
                    {['preparing', 'ready', 'delivering', 'shipped', 'completed'].includes(order.order_status) && (
                      <TouchableOpacity 
                        style={[styles.secondaryBtn, { marginRight: 8, backgroundColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center' }]}
                        onPress={async () => {
                          const shopId = await AsyncStorage.getItem('shop_id');
                          router.push({ pathname: '/order-chat' as any, params: { order_id: order.order_id, role: 'seller', user_id: shopId } });
                        }}
                      >
                        <MaterialIcons name="chat" size={14} color="#0f172a" style={{ marginRight: 4 }} />
                        <Text style={[styles.secondaryBtnText, { color: '#0f172a' }]}>แชท</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f8fafc',
  },
  menuBtn: {
    width: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  notiBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#2e7a32',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#2e7a32',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    margin: 20,
    marginBottom: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
  },
  listContainer: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 12,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 13,
    color: '#64748b',
  },
  badgeNew: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeTextNew: {
    color: '#c2410c',
    fontSize: 12,
    fontWeight: 'bold',
  },
  badgePrep: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeTextPrep: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  badgeReady: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeTextReady: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 16,
  },
  itemsText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7a32',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: '#2e7a32',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  secondaryBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
