import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../constants/api';

type FilterTab = 'all' | 'unread' | 'auction_won' | 'auction_outbid' | 'orders';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [userId, setUserId] = useState<number>(2);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const ud = await AsyncStorage.getItem('user');
      if (ud) {
        const u = JSON.parse(ud);
        if (u?.user_id) setUserId(u.user_id);
      }
    } catch (e) {
      console.log('AsyncStorage read error:', e);
    }
  };

  const fetchNotifications = async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setLoading(true);
    try {
      let currentUserId = userId || 2;
      const ud = await AsyncStorage.getItem('user');
      if (ud) {
        const u = JSON.parse(ud);
        if (u?.user_id) currentUserId = u.user_id;
      }

      const res = await axios.get(`${BASE_URL}/notifications/${currentUserId}`);
      if (res.data?.success) {
        setNotifications(res.data.notifications || []);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Fetch notifications error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications(false);
    }, [userId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications(false);
  };

  // ทำเครื่องหมายว่าอ่านแล้ว (เดี่ยว)
  const handleMarkAsRead = async (item: any) => {
    if (item.is_read) return;

    try {
      // Optimistic update
      setNotifications(prev =>
        prev.map(n =>
          n.notification_id === item.notification_id ? { ...n, is_read: true } : n
        )
      );

      await axios.put(`${BASE_URL}/notifications/${item.notification_id}/read`);
    } catch (e) {
      console.error('Mark as read error:', e);
    }
  };

  // ทำเครื่องหมายว่าอ่านทั้งหมด
  const handleMarkAllAsRead = async () => {
    const unreadCount = notifications.filter(n => !n.is_read).length;
    if (unreadCount === 0) {
      Alert.alert('แจ้งเตือน', 'คุณได้อ่านการแจ้งเตือนทั้งหมดแล้ว');
      return;
    }

    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      await axios.put(`${BASE_URL}/notifications/read-all/${userId}`);
      Alert.alert('สำเร็จ ✨', 'ทำเครื่องหมายว่าอ่านทั้งหมดเรียบร้อยแล้ว');
    } catch (e) {
      console.error('Mark all as read error:', e);
      fetchNotifications(false);
    }
  };

  // ลบการแจ้งเตือน
  const handleDeleteNotification = (notificationId: number) => {
    Alert.alert(
      'ลบการแจ้งเตือน',
      'คุณต้องการลบข้อความแจ้งเตือนนี้ใช่หรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              setNotifications(prev =>
                prev.filter(n => n.notification_id !== notificationId)
              );
              await axios.delete(`${BASE_URL}/notifications/${notificationId}`);
            } catch (e) {
              console.error('Delete notification error:', e);
              fetchNotifications(false);
            }
          }
        }
      ]
    );
  };

  // นำทางไปยังหน้าชำระเงินสำหรับผู้ชนะประมูล
  const handleGoToPayment = (item: any) => {
    handleMarkAsRead(item);

    // ดึงจำนวนเงินจาก Order หรือข้อความ
    let paymentAmount = item.order?.total_amount || 0;
    if (!paymentAmount && item.message) {
      const match = item.message.match(/฿([\d,]+)/);
      if (match && match[1]) {
        paymentAmount = parseFloat(match[1].replace(/,/g, ''));
      }
    }

    router.push({
      pathname: '/payment' as any,
      params: {
        order_id: item.reference_id || item.order?.order_id || 1,
        amount: paymentAmount || 1000,
        shop_id: item.order?.shop_id || 1
      }
    });
  };

  // นำทางไปยังห้องประมูล
  const handleGoToAuction = (item: any) => {
    handleMarkAsRead(item);
    router.push({
      pathname: '/auction-detail' as any,
      params: {
        auction_id: item.reference_id || item.auction_id || 1,
        id: item.reference_id || item.auction_id || 1
      }
    });
  };

  // นำทางไปยังหน้าติดตามออเดอร์
  const handleGoToOrderTracking = (item: any) => {
    handleMarkAsRead(item);
    router.push({
      pathname: '/order-tracking' as any,
      params: {
        order_id: item.reference_id || 1
      }
    });
  };

  // Filter รายการแจ้งเตือนตาม Tab ที่เลือก
  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.is_read;
    if (activeTab === 'auction_won') return n.type === 'auction_won';
    if (activeTab === 'auction_outbid') return n.type === 'auction_outbid';
    if (activeTab === 'orders') return n.type === 'order_status';
    return true;
  });

  const unreadTotal = notifications.filter(n => !n.is_read).length;

  // Render ข้อมูลการแจ้งเตือนแต่ละแบบ
  const renderNotificationCard = (item: any) => {
    const isWon = item.type === 'auction_won';
    const isOutbid = item.type === 'auction_outbid';
    const isLost = item.type === 'auction_lost';
    const isOrder = item.type === 'order_status';

    let cardBg = '#ffffff';
    let borderColor = '#f1f5f9';
    let iconBg = '#e2e8f0';
    let iconColor = '#475569';
    let badgeText = 'แจ้งเตือน';
    let badgeBg = '#f1f5f9';
    let badgeColor = '#475569';

    if (isWon) {
      cardBg = item.is_read ? '#fffdf7' : '#fefce8';
      borderColor = item.is_read ? '#fef08a' : '#facc15';
      iconBg = '#fef3c7';
      iconColor = '#d97706';
      badgeText = '👑 ชนะการประมูล';
      badgeBg = '#fef3c7';
      badgeColor = '#b45309';
    } else if (isOutbid) {
      cardBg = item.is_read ? '#fffaf5' : '#fff7ed';
      borderColor = item.is_read ? '#ffedd5' : '#fb923c';
      iconBg = '#ffedd5';
      iconColor = '#ea580c';
      badgeText = '⚡ ถูกเสนอราคาสูงกว่า';
      badgeBg = '#ffedd5';
      badgeColor = '#c2410c';
    } else if (isLost) {
      cardBg = '#ffffff';
      borderColor = '#f1f5f9';
      iconBg = '#f1f5f9';
      iconColor = '#64748b';
      badgeText = '⏰ สิ้นสุดการประมูล';
      badgeBg = '#f8fafc';
      badgeColor = '#64748b';
    } else if (isOrder) {
      cardBg = item.is_read ? '#f8fdf9' : '#f0fdf4';
      borderColor = item.is_read ? '#bbf7d0' : '#4ade80';
      iconBg = '#dcfce7';
      iconColor = '#16a34a';
      badgeText = '📦 สถานะคำสั่งซื้อ';
      badgeBg = '#dcfce7';
      badgeColor = '#15803d';
    }

    return (
      <TouchableOpacity
        key={item.notification_id}
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor: borderColor,
            shadowOpacity: item.is_read ? 0.03 : 0.08
          }
        ]}
        activeOpacity={0.88}
        onPress={() => handleMarkAsRead(item)}
      >
        {/* Unread Accent Bar on Left */}
        {!item.is_read && (
          <View
            style={[
              styles.unreadBar,
              { backgroundColor: isWon ? '#eab308' : isOutbid ? '#f97316' : '#22c55e' }
            ]}
          />
        )}

        <View style={styles.cardInner}>
          {/* Top Row: Type Badge + Time + Delete Button */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.badgeAndDot}>
              {!item.is_read && <View style={styles.unreadDot} />}
              <View style={[styles.typeBadge, { backgroundColor: badgeBg }]}>
                <Text style={[styles.typeBadgeText, { color: badgeColor }]}>{badgeText}</Text>
              </View>
            </View>

            <View style={styles.timeAndActions}>
              <Text style={styles.timeText}>{item.time_ago}</Text>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteNotification(item.notification_id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="close" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Middle Row: Icon & Message */}
          <View style={styles.contentRow}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              {isWon ? (
                <FontAwesome5 name="crown" size={20} color={iconColor} />
              ) : isOutbid ? (
                <MaterialCommunityIcons name="gavel" size={22} color={iconColor} />
              ) : isLost ? (
                <Ionicons name="time-outline" size={22} color={iconColor} />
              ) : (
                <MaterialIcons name="local-shipping" size={22} color={iconColor} />
              )}
            </View>

            <View style={styles.textContainer}>
              <Text style={[styles.notificationTitle, !item.is_read && styles.titleUnread]}>
                {item.title}
              </Text>
              <Text style={styles.notificationMessage} numberOfLines={3}>
                {item.message}
              </Text>
            </View>
          </View>

          {/* Action Buttons for Specific Types */}
          {isWon && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.payNowBtn}
                activeOpacity={0.8}
                onPress={() => handleGoToPayment(item)}
              >
                <MaterialIcons name="payment" size={18} color="#ffffff" />
                <Text style={styles.payNowBtnText}>ชำระเงินตอนนี้</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.viewAuctionBtn}
                activeOpacity={0.7}
                onPress={() => handleGoToAuction(item)}
              >
                <Text style={styles.viewAuctionBtnText}>ดูห้องประมูล</Text>
                <MaterialIcons name="chevron-right" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>
          )}

          {isOutbid && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.outbidActionBtn}
                activeOpacity={0.8}
                onPress={() => handleGoToAuction(item)}
              >
                <MaterialCommunityIcons name="lightning-bolt" size={18} color="#ffffff" />
                <Text style={styles.outbidActionBtnText}>เสนอราคาสู้กลับ</Text>
              </TouchableOpacity>
            </View>
          )}

          {isOrder && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.orderActionBtn}
                activeOpacity={0.8}
                onPress={() => handleGoToOrderTracking(item)}
              >
                <MaterialIcons name="location-on" size={18} color="#ffffff" />
                <Text style={styles.orderActionBtnText}>ติดตามพัสดุ</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>การแจ้งเตือน</Text>
          {unreadTotal > 0 && (
            <View style={styles.headerUnreadBadge}>
              <Text style={styles.headerUnreadText}>{unreadTotal}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.markAllBtn}
          onPress={handleMarkAllAsRead}
          activeOpacity={0.7}
        >
          <MaterialIcons name="done-all" size={20} color="#2e7a32" />
          <Text style={styles.markAllText}>อ่านทั้งหมด</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Filter Tabs */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'all' && styles.filterChipActive]}
            onPress={() => setActiveTab('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeTab === 'all' && styles.filterChipTextActive]}>
              ทั้งหมด ({notifications.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'unread' && styles.filterChipActive]}
            onPress={() => setActiveTab('unread')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeTab === 'unread' && styles.filterChipTextActive]}>
              ยังไม่อ่าน {unreadTotal > 0 ? `(${unreadTotal})` : ''}
            </Text>
            {unreadTotal > 0 && <View style={styles.chipRedDot} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'auction_won' && styles.filterChipActive]}
            onPress={() => setActiveTab('auction_won')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeTab === 'auction_won' && styles.filterChipTextActive]}>
              👑 ชนะประมูล
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'auction_outbid' && styles.filterChipActive]}
            onPress={() => setActiveTab('auction_outbid')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeTab === 'auction_outbid' && styles.filterChipTextActive]}>
              ⚡ ถูกแซงราคา
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeTab === 'orders' && styles.filterChipActive]}
            onPress={() => setActiveTab('orders')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, activeTab === 'orders' && styles.filterChipTextActive]}>
              📦 คำสั่งซื้อ
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 3. Notifications List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2e7a32" />
          <Text style={styles.loadingText}>กำลังโหลดการแจ้งเตือน...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2e7a32']}
              tintColor="#2e7a32"
            />
          }
        >
          {filteredNotifications.length > 0 ? (
            <View style={styles.cardList}>
              {filteredNotifications.map(item => renderNotificationCard(item))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <MaterialIcons name="notifications-none" size={48} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>ไม่มีการแจ้งเตือน</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'unread'
                  ? 'คุณได้อ่านการแจ้งเตือนทั้งหมดเรียบร้อยแล้ว 🎉'
                  : 'เมื่อมีการเสนอราคา ชนะการประมูล หรืออัปเดตคำสั่งซื้อ จะปรากฏที่นี่'}
              </Text>

              <TouchableOpacity
                style={styles.exploreBtn}
                onPress={() => router.replace('/(tabs)' as any)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="storefront" size={20} color="#ffffff" />
                <Text style={styles.exploreBtnText}>เลือกดูดีลและร่วมประมูล</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  headerUnreadBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  headerUnreadText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0fdf4'
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2e7a32'
  },
  filterSection: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    gap: 6
  },
  filterChipActive: {
    backgroundColor: '#2e7a32'
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b'
  },
  filterChipTextActive: {
    color: '#ffffff'
  },
  chipRedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
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
  cardList: {
    gap: 12
  },
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
    elevation: 3,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4
  },
  cardInner: {
    padding: 16
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  badgeAndDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444'
  },
  typeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: 'bold'
  },
  timeAndActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  timeText: {
    fontSize: 12,
    color: '#94a3b8'
  },
  deleteBtn: {
    padding: 2
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center'
  },
  textContainer: {
    flex: 1
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4
  },
  titleUnread: {
    fontWeight: 'bold',
    color: '#0f172a'
  },
  notificationMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)'
  },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  payNowBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold'
  },
  viewAuctionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#f1f5f9'
  },
  viewAuctionBtnText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600'
  },
  outbidActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ea580c',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  outbidActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold'
  },
  orderActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12
  },
  orderActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: 24
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2e7a32',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#2e7a32',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  exploreBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  }
});
