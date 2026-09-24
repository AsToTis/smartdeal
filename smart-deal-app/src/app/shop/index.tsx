import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import axios from 'axios';
import { BASE_URL } from '../../constants/api';

// Default Shop ID ( Zen Japanese = 1 )
const DEFAULT_SHOP_ID = 1;

export default function MerchantDashboardScreen() {
  const [shopId, setShopId] = useState(DEFAULT_SHOP_ID);
  const [shop, setShop] = useState<any>(null);
  const [stats, setStats] = useState<any>({
    total_revenue: 0,
    today_revenue: 0,
    total_orders: 0,
    pending_orders: 0,
    total_products: 0,
    balance: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allShops, setAllShops] = useState<any[]>([]);
  const [showShopPicker, setShowShopPicker] = useState(false);

  const fetchDashboardData = async () => {
    try {
      // ดึงข้อมูลร้านค้า, สถิติ, ออเดอร์ล่าสุด และรายชื่อร้านค้าทั้งหมด
      const [shopRes, statsRes, ordersRes, shopsRes] = await Promise.all([
        axios.get(`${BASE_URL}/shops/${shopId}`),
        axios.get(`${BASE_URL}/shops/${shopId}/stats`),
        axios.get(`${BASE_URL}/shops/${shopId}/orders`),
        axios.get(`${BASE_URL}/shops`)
      ]);

      if (shopRes.data.success) {
        setShop(shopRes.data.shop);
      }
      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
      }
      if (ordersRes.data.success) {
        setRecentOrders(ordersRes.data.orders.slice(0, 5));
      }
      if (shopsRes.data.success) {
        setAllShops(shopsRes.data.shops);
      }
    } catch (error: any) {
      console.error('Fetch Merchant Dashboard error:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [shopId])
  );

  const handleUpdateStatus = async (orderId: number, nextStatus: string) => {
    try {
      await axios.put(`${BASE_URL}/orders/${orderId}/status`, {
        order_status: nextStatus
      });
      Alert.alert('สำเร็จ', 'อัปเดตสถานะออเดอร์เรียบร้อยแล้ว');
      fetchDashboardData();
    } catch (error: any) {
      Alert.alert('ผิดพลาด', error.response?.data?.message || 'ไม่สามารถอัปเดตสถานะได้');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { text: 'รอดำเนินการ', bg: '#fef3c7', color: '#d97706' };
      case 'paid':
        return { text: 'ชำระเงินแล้ว', bg: '#e0f2fe', color: '#0284c7' };
      case 'preparing':
        return { text: 'กำลังเตรียม', bg: '#ffedd5', color: '#ea580c' };
      case 'ready':
        return { text: 'พร้อมส่ง/รับ', bg: '#dcfce7', color: '#16a34a' };
      case 'completed':
        return { text: 'สำเร็จแล้ว', bg: '#f1f5f9', color: '#475569' };
      case 'cancelled':
        return { text: 'ยกเลิกแล้ว', bg: '#fee2e2', color: '#dc2626' };
      default:
        return { text: status, bg: '#f1f5f9', color: '#64748b' };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#2e7a32" />
        <Text style={{ marginTop: 12, color: '#64748b' }}>กำลังโหลดข้อมูลร้านค้า...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)/profile' as any)}>
          <MaterialIcons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Merchant Center</Text>
          <Text style={styles.headerSubtitle}>{shop?.name || 'จัดการร้านค้า'}</Text>
        </View>
        <TouchableOpacity 
          style={styles.switchShopBtn}
          onPress={() => setShowShopPicker(!showShopPicker)}
        >
          <MaterialIcons name="storefront" size={20} color="#2e7a32" />
          <Text style={styles.switchShopText}>สลับร้าน</Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown เลือกร้านค้า */}
      {showShopPicker && (
        <View style={styles.shopPickerCard}>
          <Text style={styles.pickerTitle}>เลือกร้านค้าเพื่อจัดการ:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {allShops.map((s) => (
              <TouchableOpacity
                key={s.shop_id}
                style={[
                  styles.shopChip,
                  shopId === s.shop_id && styles.shopChipActive
                ]}
                onPress={() => {
                  setShopId(s.shop_id);
                  setShowShopPicker(false);
                }}
              >
                <Text style={[styles.shopChipText, shopId === s.shop_id && styles.shopChipTextActive]}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDashboardData(); }} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {/* การ์ดข้อมูลร้านค้า */}
        <View style={styles.shopBannerCard}>
          <Image
            source={{ uri: shop?.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500' }}
            style={styles.shopBannerImage}
          />
          <View style={styles.shopBannerOverlay}>
            <View style={styles.shopBannerContent}>
              <Text style={styles.shopBannerName}>{shop?.name || 'ร้านค้าของฉัน'}</Text>
              <View style={styles.shopMetaRow}>
                <View style={styles.ratingBadge}>
                  <MaterialIcons name="star" size={14} color="#f59e0b" />
                  <Text style={styles.ratingText}>{shop?.rating || '4.8'}</Text>
                </View>
                <Text style={styles.shopTagText}>{shop?.tag1 || 'อาหาร'} • {shop?.tag2 || 'ดีลพิเศษ'}</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.editShopBtn}
              onPress={() => router.push({ pathname: '/shop/edit-shop' as any, params: { shopId } })}
            >
              <MaterialIcons name="edit" size={16} color="#fff" />
              <Text style={styles.editShopText}>แก้ไข</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ยอดเงินในกระเป๋า & ยอดขาย */}
        <View style={styles.walletCard}>
          <View style={styles.walletHeader}>
            <View>
              <Text style={styles.walletLabel}>ยอดเงินใน Wallet ร้านค้า</Text>
              <Text style={styles.walletAmount}>฿{Number(stats?.balance || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.walletIconBox}>
              <FontAwesome5 name="wallet" size={24} color="#2e7a32" />
            </View>
          </View>
          <View style={styles.walletDivider} />
          <View style={styles.walletFooter}>
            <View style={styles.walletStatItem}>
              <Text style={styles.walletStatLabel}>ยอดขายวันนี้</Text>
              <Text style={styles.walletStatValue}>฿{Number(stats?.today_revenue || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.walletStatItem}>
              <Text style={styles.walletStatLabel}>ยอดขายรวมทั้งหมด</Text>
              <Text style={styles.walletStatValue}>฿{Number(stats?.total_revenue || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>
        </View>

        {/* การ์ดสถิติย่อ */}
        <View style={styles.statsGrid}>
          <TouchableOpacity 
            style={[styles.statBox, { borderLeftColor: '#ea580c' }]}
            onPress={() => router.push({ pathname: '/shop/orders' as any, params: { shopId, initialStatus: 'pending' } })}
          >
            <View style={[styles.statIconCircle, { backgroundColor: '#ffedd5' }]}>
              <MaterialIcons name="receipt-long" size={20} color="#ea580c" />
            </View>
            <Text style={styles.statCount}>{stats?.pending_orders || 0}</Text>
            <Text style={styles.statName}>ออเดอร์ต้องทำ</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statBox, { borderLeftColor: '#0284c7' }]}
            onPress={() => router.push({ pathname: '/shop/orders' as any, params: { shopId } })}
          >
            <View style={[styles.statIconCircle, { backgroundColor: '#e0f2fe' }]}>
              <MaterialIcons name="shopping-bag" size={20} color="#0284c7" />
            </View>
            <Text style={styles.statCount}>{stats?.total_orders || 0}</Text>
            <Text style={styles.statName}>ออเดอร์ทั้งหมด</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.statBox, { borderLeftColor: '#16a34a' }]}
            onPress={() => router.push({ pathname: '/shop/products' as any, params: { shopId } })}
          >
            <View style={[styles.statIconCircle, { backgroundColor: '#dcfce7' }]}>
              <MaterialIcons name="inventory" size={20} color="#16a34a" />
            </View>
            <Text style={styles.statCount}>{stats?.total_products || 0}</Text>
            <Text style={styles.statName}>สินค้าในร้าน</Text>
          </TouchableOpacity>
        </View>

        {/* เมนูจัดการด่วน (Quick Actions) */}
        <Text style={styles.sectionTitle}>เมนูจัดการร้านค้า</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push({ pathname: '/shop/orders' as any, params: { shopId } })}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#eff6ff' }]}>
              <MaterialIcons name="notifications-active" size={26} color="#2563eb" />
            </View>
            <Text style={styles.actionTitle}>รายการออเดอร์เข้า</Text>
            <Text style={styles.actionDesc}>ตรวจสอบและอัปเดตสถานะ</Text>
            {stats?.pending_orders > 0 && (
              <View style={styles.actionBadge}>
                <Text style={styles.actionBadgeText}>{stats.pending_orders}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push({ pathname: '/shop/products' as any, params: { shopId } })}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#ecfdf5' }]}>
              <MaterialIcons name="fastfood" size={26} color="#059669" />
            </View>
            <Text style={styles.actionTitle}>จัดการสินค้าในร้าน</Text>
            <Text style={styles.actionDesc}>แก้ไขราคา ดีล สต็อก</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push({ pathname: '/shop/add-product' as any, params: { shopId } })}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#fdf2f8' }]}>
              <MaterialIcons name="add-circle" size={26} color="#db2777" />
            </View>
            <Text style={styles.actionTitle}>เพิ่มสินค้าใหม่</Text>
            <Text style={styles.actionDesc}>ลงขายดีลและสินค้าลดราคา</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push({ pathname: '/shop/edit-shop' as any, params: { shopId } })}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#fefce8' }]}>
              <MaterialIcons name="store" size={26} color="#ca8a04" />
            </View>
            <Text style={styles.actionTitle}>แก้ไขข้อมูลร้าน</Text>
            <Text style={styles.actionDesc}>ชื่อ รูปภาพ พร้อมเพย์</Text>
          </TouchableOpacity>
        </View>

        {/* ออเดอร์ล่าสุด (Recent Orders) */}
        <View style={styles.recentHeaderRow}>
          <Text style={styles.sectionTitle}>ออเดอร์ล่าสุด</Text>
          <TouchableOpacity onPress={() => router.push({ pathname: '/shop/orders' as any, params: { shopId } })}>
            <Text style={styles.viewAllText}>ดูทั้งหมด ({recentOrders.length})</Text>
          </TouchableOpacity>
        </View>

        {recentOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="inbox" size={40} color="#cbd5e1" />
            <Text style={styles.emptyText}>ยังไม่มีคำสั่งซื้อเข้ามาในขณะนี้</Text>
          </View>
        ) : (
          recentOrders.map((order) => {
            const badge = getStatusBadge(order.order_status);
            return (
              <View key={order.order_id} style={styles.orderCard}>
                <View style={styles.orderCardHeader}>
                  <View>
                    <Text style={styles.orderIdText}>ออเดอร์ #{order.order_id}</Text>
                    <Text style={styles.orderTimeText}>{new Date(order.created_at).toLocaleString('th-TH')}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.text}</Text>
                  </View>
                </View>

                {/* รายการสินค้าสั้นๆ */}
                <View style={styles.orderItemsList}>
                  {order.items?.map((item: any, idx: number) => (
                    <Text key={idx} style={styles.orderItemText} numberOfLines={1}>
                      • {item.product_name} x {item.quantity} (฿{Number(item.price * item.quantity).toFixed(2)})
                    </Text>
                  ))}
                </View>

                <View style={styles.orderCustomerRow}>
                  <Text style={styles.customerText}>ลูกค้า: {order.receiver_name || order.customer_name || 'ลูกค้า'}</Text>
                  <Text style={styles.orderTotalText}>ยอดรวม: ฿{Number(order.total_amount).toFixed(2)}</Text>
                </View>

                {/* Quick Status Action Button */}
                {(order.order_status === 'pending' || order.order_status === 'paid') && (
                  <TouchableOpacity 
                    style={[styles.quickActionBtn, { backgroundColor: '#ea580c' }]}
                    onPress={() => handleUpdateStatus(order.order_id, 'preparing')}
                  >
                    <Ionicons name="restaurant-outline" size={16} color="#fff" />
                    <Text style={styles.quickActionBtnText}>รับออเดอร์ / เริ่มเตรียมอาหาร</Text>
                  </TouchableOpacity>
                )}

                {order.order_status === 'preparing' && (
                  <TouchableOpacity 
                    style={[styles.quickActionBtn, { backgroundColor: '#16a34a' }]}
                    onPress={() => handleUpdateStatus(order.order_id, 'ready')}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                    <Text style={styles.quickActionBtnText}>เตรียมเสร็จแล้ว / พร้อมส่ง</Text>
                  </TouchableOpacity>
                )}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0'
  },
  backBtn: { padding: 6, borderRadius: 8, backgroundColor: '#f1f5f9' },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  headerSubtitle: { fontSize: 13, color: '#64748b' },
  switchShopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 4
  },
  switchShopText: { fontSize: 12, fontWeight: 'bold', color: '#16a34a' },
  shopPickerCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0'
  },
  pickerTitle: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  shopChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8
  },
  shopChipActive: { backgroundColor: '#2e7a32' },
  shopChipText: { fontSize: 13, color: '#334155', fontWeight: '500' },
  shopChipTextActive: { color: '#fff', fontWeight: 'bold' },
  shopBannerCard: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 140,
    marginBottom: 16,
    position: 'relative'
  },
  shopBannerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  shopBannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 16
  },
  shopBannerContent: { flex: 1 },
  shopBannerName: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  shopMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2
  },
  ratingText: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
  shopTagText: { fontSize: 12, color: '#e2e8f0' },
  editShopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4
  },
  editShopText: { fontSize: 12, color: '#fff', fontWeight: 'bold' },
  walletCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  walletHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  walletLabel: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  walletAmount: { fontSize: 26, fontWeight: 'bold', color: '#16a34a', marginTop: 4 },
  walletIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center'
  },
  walletDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 14 },
  walletFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  walletStatItem: { flex: 1 },
  walletStatLabel: { fontSize: 11, color: '#94a3b8' },
  walletStatValue: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginTop: 2 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center'
  },
  statIconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  statCount: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  statName: { fontSize: 11, color: '#64748b', marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  actionCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative'
  },
  actionIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  actionTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 },
  actionDesc: { fontSize: 11, color: '#64748b' },
  actionBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10
  },
  actionBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  recentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  viewAllText: { fontSize: 13, color: '#2563eb', fontWeight: 'bold' },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  emptyText: { marginTop: 8, fontSize: 13, color: '#94a3b8' },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12
  },
  orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  orderIdText: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  orderTimeText: { fontSize: 11, color: '#94a3b8' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: 'bold' },
  orderItemsList: { backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, marginVertical: 6 },
  orderItemText: { fontSize: 12, color: '#334155', marginVertical: 1 },
  orderCustomerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 8 },
  customerText: { fontSize: 12, color: '#64748b' },
  orderTotalText: { fontSize: 13, fontWeight: 'bold', color: '#16a34a' },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    marginTop: 4
  },
  quickActionBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
});
