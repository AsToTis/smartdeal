import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Image, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../../constants/api';

export default function SellerDashboardScreen() {
  const getImageUrl = (imgUrl: string) => {
    if (!imgUrl) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
    if (imgUrl.startsWith('http')) return imgUrl;
    return `${BASE_URL.replace('/api', '')}${imgUrl}`;
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>({
    shop: { name: 'Smart Deal Seller', is_open: 1 },
    stats: { today_sales: 0, today_orders: 0 },
    recentOrders: []
  });

  const fetchDashboardData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (!userData) {
        router.replace('/(tabs)/profile');
        return;
      }
      
      const user = JSON.parse(userData);
      const userId = user?.user_id;

      if (!userId) {
        router.replace('/(tabs)/profile');
        return;
      }

      // เช็กร้านค้าจาก owner_id (user_id) เสมอ
      const res = await axios.get(`${BASE_URL}/seller/dashboard/${userId}`);
      
      if (res.data?.success && res.data?.shop?.status === 'approved') {
        setDashboardData(res.data);
      } else {
        // ถ้าสถานะไม่ใช่ approved หรือไม่มีร้าน ให้เด้งกลับหน้า Profile ทันที
        router.replace('/(tabs)/profile');
        return;
      }

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      router.replace('/(tabs)/profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  const isShopOpen = dashboardData.shop?.is_open === 1 || dashboardData.shop?.is_open === true || dashboardData.shop?.is_open === undefined;

  const toggleShopStatus = async (newVal: boolean) => {
    const newStatus = newVal ? 1 : 0;
    setDashboardData((prev: any) => ({
      ...prev,
      shop: { ...prev.shop, is_open: newStatus }
    }));

    if (dashboardData.shop?.shop_id) {
      try {
        await axios.put(`${BASE_URL}/seller/toggle-status/${dashboardData.shop.shop_id}`, { is_open: newStatus });
      } catch (err) {
        console.error('Error toggling shop status:', err);
      }
    }
  };

  const formatMoney = (amount: number) => {
    return Number(amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

    return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.shopIconCircle}>
            <MaterialIcons name="storefront" size={24} color="#16a34a" />
          </View>
          <View>
            <Text style={styles.headerTitle}>{dashboardData.shop?.name || 'Smart Deal Seller'}</Text>
            <Text style={styles.headerSubtitle}>ยินดีต้อนรับกลับมา</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(seller)/notifications')}>
            <Ionicons name="notifications-outline" size={22} color="#64748b" />
            <View style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', borderWidth: 1, borderColor: '#fff' }} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDashboardData(); }} />}
      >
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#16a34a" />
          </View>
        ) : (
          <View style={styles.content}>
            {/* สถานะร้านค้า Quick Toggle */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: isShopOpen ? '#f0fdf4' : '#fef2f2',
              borderColor: isShopOpen ? '#bbf7d0' : '#fecaca',
              borderWidth: 1,
              borderRadius: 16,
              padding: 14,
              marginBottom: 16,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: isShopOpen ? '#dcfce7' : '#fee2e2',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12
                }}>
                  <MaterialIcons name="storefront" size={22} color={isShopOpen ? '#16a34a' : '#ef4444'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: isShopOpen ? '#15803d' : '#b91c1c' }}>
                    {isShopOpen ? '🟢 ร้านเปิดรับออเดอร์อยู่' : '🔴 ร้านปิดให้บริการชั่วคราว'}
                  </Text>
                  <Text style={{ fontSize: 12, color: isShopOpen ? '#16a34a' : '#dc2626', marginTop: 1 }}>
                    {isShopOpen ? 'ลูกค้ากำลังมองเห็นและสั่งซื้อสินค้าได้' : 'สินค้าถูกซ่อนออกจากหน้าร้านผู้ซื้อ'}
                  </Text>
                </View>
              </View>
              <Switch
                trackColor={{ false: '#cbd5e1', true: '#16a34a' }}
                thumbColor={'#fff'}
                value={isShopOpen}
                onValueChange={toggleShopStatus}
              />
            </View>

            {/* สรุปยอด */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ยอดขายวันนี้</Text>
              <TouchableOpacity onPress={() => router.push('/(seller)/wallet')}>
                <Text style={styles.sectionLink}>ดูรายละเอียด</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={styles.statIconRow}>
                  <MaterialIcons name="payments" size={16} color="#16a34a" />
                  <Text style={styles.statLabel}>ยอดขายรวม (วันนี้)</Text>
                </View>
                <Text style={styles.statValue}>฿{formatMoney(dashboardData.stats?.today_sales || 0)}</Text>
                <Text style={[styles.statChange, { color: '#16a34a' }]}>
                  <Ionicons name="trending-up" size={12} /> +15.2%
                </Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statIconRow}>
                  <MaterialIcons name="shopping-cart" size={16} color="#16a34a" />
                  <Text style={styles.statLabel}>คำสั่งซื้อ (รวม)</Text>
                </View>
                <Text style={styles.statValue}>{dashboardData.stats?.today_orders || 0}</Text>
                <Text style={[styles.statChange, { color: '#16a34a' }]}>
                  <Ionicons name="trending-up" size={12} /> +5.4%
                </Text>
              </View>
            </View>

            {/* กราฟหลอก */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>สรุปยอดขายรายสัปดาห์</Text>
                <View style={styles.chartBadge}>
                  <Text style={styles.chartBadgeText}>สัปดาห์นี้ <MaterialIcons name="keyboard-arrow-down" size={14} /></Text>
                </View>
              </View>
              
              <View style={styles.dummyChartSpace}>
                {/* Dummy Chart Bars */}
                {['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'].map((day, i) => {
                  const todayIndex = (new Date().getDay() + 6) % 7;
                  const isToday = i === todayIndex;
                  return (
                    <View key={i} style={styles.chartCol}>
                      <View style={[styles.chartBar, { height: isToday ? 80 : Math.random() * 50 + 20, backgroundColor: isToday ? '#16a34a' : '#e2e8f0' }]} />
                      <Text style={[styles.chartDayText, isToday && { fontWeight: 'bold', color: '#0f172a' }]}>{day}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.chartFooter}>
                <Text style={styles.chartFooterLabel}>เฉลี่ยต่อวัน</Text>
                <Text style={styles.chartFooterValue}>฿{formatMoney((dashboardData.stats?.today_sales || 0) / 1.5)}</Text>
              </View>
            </View>

            {/* เมนูลัด */}
            <Text style={styles.sectionTitle}>การจัดการด่วน</Text>
            <View style={styles.quickActionGrid}>
              <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(seller)/products')}>
                <View style={[styles.actionIconCircle, { backgroundColor: '#eff6ff' }]}>
                  <MaterialIcons name="inventory-2" size={24} color="#3b82f6" />
                </View>
                <View>
                  <Text style={styles.actionTitle}>สินค้า</Text>
                  <Text style={styles.actionDesc}>เพิ่ม/แก้ไขสินค้า</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(seller)/orders')}>
                <View style={[styles.actionIconCircle, { backgroundColor: '#fff7ed' }]}>
                  <MaterialIcons name="assignment-late" size={24} color="#f97316" />
                </View>
                <View>
                  <Text style={styles.actionTitle}>รอส่ง</Text>
                  <Text style={styles.actionDesc}>0 รายการใหม่</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* รายการล่าสุด */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>รายการสั่งซื้อล่าสุด</Text>
              <TouchableOpacity onPress={() => router.push('/(seller)/orders')}>
                <Text style={styles.sectionLink}>ดูทั้งหมด</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.recentOrdersCard}>
              {dashboardData.recentOrders && dashboardData.recentOrders.length > 0 ? (
                dashboardData.recentOrders.map((item: any, index: number) => (
                  <TouchableOpacity 
                    key={item.order_id || index} 
                    style={[styles.recentOrderItem, index > 0 && { marginTop: 16 }]}
                    onPress={() => router.push({ pathname: '/(seller)/order-details', params: { orderId: item.order_id } })}
                  >
                    <View style={styles.recentOrderIcon}>
                      <Image source={{ uri: getImageUrl(item.image_url || item.product_image) }} style={styles.recentOrderImg} />
                    </View>
                    <View style={styles.recentOrderInfo}>
                      <Text style={styles.recentOrderName}>รหัสออเดอร์ #{item.order_id}</Text>
                      <Text style={styles.recentOrderSub}>{item.product_name || 'รายการอาหาร'}</Text>
                    </View>
                    <View style={styles.recentOrderRight}>
                      <Text style={styles.recentOrderPrice}>฿{formatMoney(item.subtotal || item.total_amount)}</Text>
                      <View style={[styles.statusBadge, item.order_status === 'completed' && {backgroundColor: '#dcfce7'}]}>
                        <Text style={[styles.statusText, item.order_status === 'completed' && {color: '#16a34a'}]}>{item.order_status}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={{ textAlign: 'center', color: '#64748b', marginVertical: 10 }}>ยังไม่มีรายการสั่งซื้อล่าสุด</Text>
              )}
            </View>

          </View>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shopIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  sectionLink: {
    fontSize: 14,
    color: '#16a34a',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#e6f4ea',
    borderRadius: 16,
    padding: 16,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 13,
    color: '#475569',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  statChange: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  chartBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chartBadgeText: {
    fontSize: 12,
    color: '#475569',
  },
  dummyChartSpace: {
    height: 120,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  chartCol: {
    alignItems: 'center',
    width: 30,
  },
  chartBar: {
    width: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  chartDayText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  chartFooterLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  chartFooterValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  quickActionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 12,
    color: '#64748b',
  },
  recentOrdersCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  recentOrderItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentOrderIcon: {
    marginRight: 12,
  },
  recentOrderImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  recentOrderInfo: {
    flex: 1,
  },
  recentOrderName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 2,
  },
  recentOrderSub: {
    fontSize: 12,
    color: '#64748b',
  },
  recentOrderRight: {
    alignItems: 'flex-end',
  },
  recentOrderPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  statusBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    color: '#d97706',
    fontWeight: 'bold',
  }
});
