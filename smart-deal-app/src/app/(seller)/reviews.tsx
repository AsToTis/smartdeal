import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, 
  ActivityIndicator, RefreshControl, Modal, Dimensions, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL, SERVER_URL } from '../../constants/api';

const { width } = Dimensions.get('window');

export default function SellerReviewsScreen() {
  const params = useLocalSearchParams();
  const [shopId, setShopId] = useState<number | null>(params.shop_id ? Number(params.shop_id) : null);
  const [shopName, setShopName] = useState<string>('ร้านค้าของคุณ');
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Helper to format image URLs
  const getFullImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('file://')) {
      return url;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url.replace(/^http:\/\/(localhost|127\.0\.0\.1|202\.28\.34\.205)(:\d+)?/, SERVER_URL);
    }
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    if (cleanPath.startsWith('/uploads/')) {
      return `${SERVER_URL}${cleanPath}`;
    }
    return `${SERVER_URL}/uploads${cleanPath}`;
  };

  // Helper format Thai date
  const formatThaiDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      if (isNaN(d.getTime())) return dateStr;
      const thMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const day = d.getDate();
      const month = thMonths[d.getMonth()];
      const year = d.getFullYear() + 543;
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day} ${month} ${year} ${hours}:${minutes} น.`;
    } catch (e) {
      return dateStr;
    }
  };

  // Resolve shop_id if missing
  const initShop = async () => {
    try {
      let currentShopId = shopId;
      if (!currentShopId) {
        const storedShopId = await AsyncStorage.getItem('shop_id');
        if (storedShopId) {
          currentShopId = Number(storedShopId);
          setShopId(currentShopId);
        } else {
          const userData = await AsyncStorage.getItem('user');
          if (userData) {
            const parsed = JSON.parse(userData);
            if (parsed.user_id) {
              const res = await axios.get(`${BASE_URL}/seller/settings/${parsed.user_id}`);
              if (res.data?.success && res.data.data?.shop_id) {
                currentShopId = Number(res.data.data.shop_id);
                setShopId(currentShopId);
                setShopName(res.data.data.name || 'ร้านค้าของคุณ');
              }
            }
          }
        }
      }
      return currentShopId || 1;
    } catch (e) {
      console.error('Error init shop:', e);
      return 1;
    }
  };

  const fetchReviews = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const activeShopId = await initShop();
      const res = await axios.get(`${BASE_URL}/shops/${activeShopId}/reviews`);
      if (res.data?.success) {
        setReviews(res.data.reviews || []);
      }
    } catch (error) {
      console.error('Error fetching shop reviews:', error);
    } finally {
      if (showLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReviews(true);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReviews(false);
  }, []);

  // Compute rating metrics
  const stats = useMemo(() => {
    if (!reviews || reviews.length === 0) {
      return { avg: 0, total: 0, count5: 0, count4: 0, count3: 0, count12: 0, countPhoto: 0 };
    }
    const total = reviews.length;
    let sum = 0;
    let count5 = 0;
    let count4 = 0;
    let count3 = 0;
    let count12 = 0;
    let countPhoto = 0;

    reviews.forEach(r => {
      const rate = Number(r.rating) || 5;
      sum += rate;
      if (rate >= 5) count5++;
      else if (rate === 4) count4++;
      else if (rate === 3) count3++;
      else count12++;

      if (r.image_url) countPhoto++;
    });

    return {
      avg: Number((sum / total).toFixed(1)),
      total,
      count5,
      count4,
      count3,
      count12,
      countPhoto
    };
  }, [reviews]);

  // Filtered list
  const filteredReviews = useMemo(() => {
    if (selectedFilter === 'all') return reviews;
    if (selectedFilter === '5') return reviews.filter(r => Number(r.rating) >= 5);
    if (selectedFilter === '4') return reviews.filter(r => Number(r.rating) === 4);
    if (selectedFilter === '3') return reviews.filter(r => Number(r.rating) === 3);
    if (selectedFilter === '1-2') return reviews.filter(r => Number(r.rating) <= 2);
    if (selectedFilter === 'photo') return reviews.filter(r => !!r.image_url);
    return reviews;
  }, [reviews, selectedFilter]);

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(<MaterialIcons key={i} name="star" size={16} color="#f59e0b" />);
      } else {
        stars.push(<MaterialIcons key={i} name="star-border" size={16} color="#cbd5e1" />);
      }
    }
    return <View style={styles.starRow}>{stars}</View>;
  };

  const renderReviewItem = ({ item }: { item: any }) => {
    const avatarUri = item.user_avatar ? getFullImageUrl(item.user_avatar) : null;
    const reviewImageUri = item.image_url ? getFullImageUrl(item.image_url) : null;
    const initialLetter = item.user_name ? item.user_name.charAt(0) : 'ล';

    return (
      <View style={styles.reviewCard}>
        {/* Header: User Info & Order ID */}
        <View style={styles.reviewHeader}>
          <View style={styles.userInfoRow}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.userAvatar} />
            ) : (
              <View style={styles.userAvatarPlaceholder}>
                <Text style={styles.avatarInitial}>{initialLetter}</Text>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.userName} numberOfLines={1}>{item.user_name || 'ลูกค้าทั่วไป'}</Text>
              <Text style={styles.reviewDate}>{formatThaiDate(item.created_at)}</Text>
            </View>
          </View>

          {item.order_id && (
            <View style={styles.orderPill}>
              <MaterialIcons name="receipt" size={12} color="#16a34a" />
              <Text style={styles.orderPillText}>#ORD-{item.order_id}</Text>
            </View>
          )}
        </View>

        {/* Rating Stars */}
        <View style={styles.ratingBadgeRow}>
          {renderStars(Number(item.rating) || 5)}
          <Text style={styles.ratingNumText}>{Number(item.rating || 5).toFixed(1)}</Text>
        </View>

        {/* Comment Text */}
        {item.comment && item.comment.trim() ? (
          <Text style={styles.commentText}>{item.comment}</Text>
        ) : (
          <Text style={styles.noCommentText}>ลูกค้าไม่ได้ระบุข้อความรีวิว</Text>
        )}

        {/* Review Image (if attached) */}
        {reviewImageUri && (
          <TouchableOpacity 
            style={styles.reviewImageContainer}
            activeOpacity={0.8}
            onPress={() => setPreviewImage(reviewImageUri)}
          >
            <Image source={{ uri: reviewImageUri }} style={styles.reviewImageThumb} />
            <View style={styles.imageZoomBadge}>
              <MaterialIcons name="zoom-in" size={14} color="#fff" />
              <Text style={styles.imageZoomText}>ดูภาพเต็ม</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>รีวิวและคะแนนร้านค้า</Text>
          <Text style={styles.headerSubtitle}>{shopName}</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <MaterialIcons name="refresh" size={22} color="#16a34a" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>กำลังโหลดรีวิวจากลูกค้า...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredReviews}
          keyExtractor={(item) => String(item.review_id || item.order_id || Math.random())}
          renderItem={renderReviewItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />
          }
          ListHeaderComponent={
            <View style={styles.statsContainer}>
              {/* Overall Rating Card */}
              <View style={styles.overallRatingCard}>
                <View style={styles.ratingBigCol}>
                  <Text style={styles.ratingBigNumber}>{stats.avg > 0 ? stats.avg.toFixed(1) : '5.0'}</Text>
                  <View style={{ flexDirection: 'row', marginTop: 2 }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <MaterialIcons 
                        key={star} 
                        name={star <= Math.round(stats.avg || 5) ? 'star' : 'star-border'} 
                        size={18} 
                        color="#f59e0b" 
                      />
                    ))}
                  </View>
                  <Text style={styles.totalReviewsText}>จากทั้งหมด {stats.total} รีวิว</Text>
                </View>

                {/* Rating Distribution Bar */}
                <View style={styles.barsCol}>
                  {[
                    { label: '5 ดาว', count: stats.count5 },
                    { label: '4 ดาว', count: stats.count4 },
                    { label: '3 ดาว', count: stats.count3 },
                    { label: '1-2 ดาว', count: stats.count12 }
                  ].map((row, idx) => {
                    const percent = stats.total > 0 ? (row.count / stats.total) * 100 : 0;
                    return (
                      <View key={idx} style={styles.barRow}>
                        <Text style={styles.barLabel}>{row.label}</Text>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { width: `${percent}%` }]} />
                        </View>
                        <Text style={styles.barCount}>{row.count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Filter Chips */}
              <View style={styles.filterScrollView}>
                {[
                  { key: 'all', label: `ทั้งหมด (${stats.total})` },
                  { key: '5', label: `5 ดาว ⭐ (${stats.count5})` },
                  { key: '4', label: `4 ดาว ⭐ (${stats.count4})` },
                  { key: '3', label: `3 ดาว ⭐ (${stats.count3})` },
                  { key: '1-2', label: `1-2 ดาว ⭐ (${stats.count12})` },
                  { key: 'photo', label: `มีรูปภาพ 📷 (${stats.countPhoto})` },
                ].map(filter => {
                  const isActive = selectedFilter === filter.key;
                  return (
                    <TouchableOpacity
                      key={filter.key}
                      style={[styles.filterChip, isActive && styles.filterChipActive]}
                      onPress={() => setSelectedFilter(filter.key)}
                    >
                      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                        {filter.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionHeaderTitle}>
                ความคิดเห็นจากลูกค้า ({filteredReviews.length} รายการ)
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="rate-review" size={56} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>ยังไม่มีรีวิวในหมวดหมู่นี้</Text>
              <Text style={styles.emptySubtitle}>รีวิวจากลูกค้าที่สั่งซื้อจะปรากฏที่นี่</Text>
            </View>
          }
        />
      )}

      {/* Image Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalCloseBtn} 
            onPress={() => setPreviewImage(null)}
          >
            <MaterialIcons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {previewImage && (
            <Image 
              source={{ uri: previewImage }} 
              style={styles.modalFullImage} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#16a34a',
    marginTop: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statsContainer: {
    marginBottom: 16,
  },
  overallRatingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  ratingBigCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
    minWidth: 105,
  },
  ratingBigNumber: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#0f172a',
    letterSpacing: -1,
  },
  totalReviewsText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  barsCol: {
    flex: 1,
    paddingLeft: 16,
    gap: 6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barLabel: {
    width: 42,
    fontSize: 11,
    color: '#64748b',
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 3,
  },
  barCount: {
    width: 20,
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'right',
  },
  filterScrollView: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  filterChip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  filterChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 18,
    marginBottom: 4,
  },
  reviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  userAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  userName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  reviewDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  orderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  orderPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16a34a',
  },
  ratingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingNumText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  commentText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginTop: 8,
  },
  noCommentText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 6,
  },
  reviewImageContainer: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    width: 140,
    height: 100,
    position: 'relative',
    backgroundColor: '#f1f5f9',
  },
  reviewImageThumb: {
    width: '100%',
    height: '100%',
  },
  imageZoomBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  imageZoomText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  chatCustomerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  chatCustomerBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#64748b',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  modalFullImage: {
    width: width * 0.95,
    height: '80%',
  },
});
