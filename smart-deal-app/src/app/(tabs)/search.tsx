import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TextInput, ScrollView, 
  TouchableOpacity, Image, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../constants/api';
import { useCart } from '../../context/CartContext';

export default function SearchScreen() {
  const { addToCart } = useCart();
  const [searchTerm, setSearchTerm] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'near' | 'popular' | 'discount'>('near');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const [searchResults, setSearchResults] = useState<{shops: any[], products: any[]}>({ shops: [], products: [] });
  const [loading, setLoading] = useState(false);
  const [nearbyShops, setNearbyShops] = useState<any[]>([]);
  const [trendingDeals, setTrendingDeals] = useState<any[]>([]);

  const getImageUrl = (url: string) => {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
    }
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `${BASE_URL.replace('/api', '')}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const loadData = async () => {
    try {
      const [shopsRes, homeRes] = await Promise.all([
        axios.get(`${BASE_URL}/shops/nearby`).catch(() => ({ data: [] })),
        axios.get(`${BASE_URL}/home-data`).catch(() => ({ data: { deals: [], shops: [] } }))
      ]);

      if (Array.isArray(shopsRes.data) && shopsRes.data.length > 0) {
        setNearbyShops(shopsRes.data);
      } else if (homeRes.data?.shops && homeRes.data.shops.length > 0) {
        setNearbyShops(homeRes.data.shops);
      }

      if (homeRes.data?.deals && Array.isArray(homeRes.data.deals)) {
        setTrendingDeals(homeRes.data.deals);
      }
    } catch (e) {
      console.log('Load search screen data error:', e);
    }
  };

  const loadRecentSearches = async () => {
    try {
      const saved = await AsyncStorage.getItem('recent_searches');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (e) {}
  };

  useFocusEffect(
    useCallback(() => {
      loadRecentSearches();
      loadData();
    }, [])
  );

  const saveRecentSearch = async (keyword: string) => {
    if (!keyword.trim()) return;
    try {
      let updated = [keyword.trim(), ...recentSearches.filter(k => k !== keyword.trim())];
      updated = updated.slice(0, 10);
      setRecentSearches(updated);
      await AsyncStorage.setItem('recent_searches', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleClearHistory = async () => {
    setRecentSearches([]);
    await AsyncStorage.removeItem('recent_searches');
  };

  const performSearch = async (keyword: string) => {
    if (!keyword.trim()) {
      setHasSearched(false);
      setSearchResults({ shops: [], products: [] });
      return;
    }
    
    setHasSearched(true);
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/search?keyword=${encodeURIComponent(keyword.trim())}`);
      if (res.data?.success) {
        setSearchResults({
          shops: res.data.shops || [],
          products: res.data.products || []
        });
      }
      saveRecentSearch(keyword);
    } catch (error) {
      console.log('Search API Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChipClick = (keyword: string) => {
    setSearchTerm(keyword);
    performSearch(keyword);
  };

  // Sorted trending deals based on selected filter
  const displayedDeals = [...trendingDeals].sort((a, b) => {
    if (selectedFilter === 'discount') {
      return (b.discount_percent || 0) - (a.discount_percent || 0);
    }
    if (selectedFilter === 'popular') {
      return (b.sold_count || 0) - (a.sold_count || 0);
    }
    return 0; // Default
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.circleBackBtn} 
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)');
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={22} color="#16a34a" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>ค้นหาดีลอัจฉริยะ</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 2. Search Input Bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <TouchableOpacity onPress={() => performSearch(searchTerm)}>
            <MaterialIcons name="search" size={22} color="#16a34a" />
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            placeholder="ค้นหาร้านค้า, เมนูอาหาร หรือดีลลดราคา"
            placeholderTextColor="#94a3b8"
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={() => performSearch(searchTerm)}
            returnKeyType="search"
          />
          {searchTerm.length > 0 ? (
            <TouchableOpacity onPress={() => {
              setSearchTerm('');
              setHasSearched(false);
              setSearchResults({shops: [], products: []});
            }}>
              <MaterialIcons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.searchFilterCircle}>
              <MaterialIcons name="tune" size={16} color="#16a34a" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3. Filter Pills */}
      <View style={styles.filterPillsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
          <TouchableOpacity 
            style={[styles.pillBtn, selectedFilter === 'near' && styles.pillBtnActive]}
            onPress={() => setSelectedFilter('near')}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillText, selectedFilter === 'near' && styles.pillTextActive]}>
              ใกล้ฉันที่สุด ▾
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.pillBtn, selectedFilter === 'popular' && styles.pillBtnActive]}
            onPress={() => setSelectedFilter('popular')}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillText, selectedFilter === 'popular' && styles.pillTextActive]}>
              ร้านยอดนิยม ▾
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.pillBtn, selectedFilter === 'discount' && styles.pillBtnActive]}
            onPress={() => setSelectedFilter('discount')}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillText, selectedFilter === 'discount' && styles.pillTextActive]}>
              ส่วนลดสูงสุด ▾
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {!hasSearched && !loading ? (
          <>
            {/* 4. ส่วนประวัติการค้นหาล่าสุด */}
            {recentSearches.length > 0 && (
              <View style={styles.recentSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>ประวัติการค้นหาล่าสุด</Text>
                  <TouchableOpacity onPress={handleClearHistory}>
                    <Text style={styles.clearAllText}>ล้างทั้งหมด</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.chipsWrap}>
                  {recentSearches.map((keyword, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.recentChip}
                      onPress={() => handleSearchChipClick(keyword)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="history" size={16} color="#64748b" />
                      <Text style={styles.recentChipText}>{keyword}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* 4.5 ส่วนร้านค้าใกล้ฉัน (Nearby Shops) */}
            {nearbyShops.length > 0 && (
              <View style={styles.nearbySection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.trendingHeading}>ร้านค้าใกล้ฉัน</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)')}>
                    <Text style={styles.clearAllText}>ดูทั้งหมด</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView 
                  horizontal={true} 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingRight: 20 }}
                  style={{ marginBottom: 20 }}
                >
                  {nearbyShops.map((shop, index) => (
                    <TouchableOpacity 
                      key={shop.shop_id || index}
                      style={styles.nearbyCard}
                      onPress={() => router.push({ pathname: '/shop-profile', params: { id: shop.shop_id } })}
                      activeOpacity={0.85}
                    >
                      <Image 
                        source={{ uri: getImageUrl(shop.image_url) }} 
                        style={styles.nearbyImage} 
                      />
                      <View style={styles.nearbyCardBody}>
                        <Text style={styles.nearbyShopTitle} numberOfLines={1}>{shop.name || 'ร้านค้าพรีเมียม'}</Text>
                        <View style={styles.nearbySubRow}>
                          <View style={styles.cardRating}>
                            <MaterialIcons name="star" size={14} color="#f59e0b" />
                            <Text style={styles.ratingNumSmall}>{shop.rating || '5.0'}</Text>
                          </View>
                          <Text style={styles.nearbyDistance}>• {shop.distance || 'ใกล้คุณ'}</Text>
                        </View>
                        <View style={styles.nearbyBadgeRow}>
                          <View style={styles.smartDealBadge}>
                            <Text style={styles.smartDealBadgeText}>SMART DEAL</Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* 5. ส่วนดีลที่กำลังมาแรง (Trending Deals) จาก Database จริง */}
            <Text style={styles.trendingHeading}>ดีลที่กำลังมาแรง ({displayedDeals.length})</Text>
            {displayedDeals.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center', backgroundColor: '#fff', borderRadius: 16 }}>
                <MaterialIcons name="local-offer" size={40} color="#cbd5e1" />
                <Text style={{ marginTop: 10, color: '#64748b' }}>ยังไม่มีดีลที่กำลังมาแรงในขณะนี้</Text>
              </View>
            ) : (
              <View style={styles.dealsList}>
                {displayedDeals.map((deal) => {
                  const discPrice = deal.discount_price ?? deal.price ?? 0;
                  const origPrice = deal.original_price ?? deal.price ?? 0;
                  const discountPercent = deal.discount_percent || (origPrice > discPrice ? Math.round(((origPrice - discPrice) / origPrice) * 100) : 0);

                  return (
                    <TouchableOpacity
                      key={deal.product_id}
                      style={styles.dealCard}
                      onPress={() => router.push({
                        pathname: '/product-detail',
                        params: { id: deal.product_id }
                      })}
                      activeOpacity={0.9}
                    >
                      <View style={styles.cardImageWrapper}>
                        <Image source={{ uri: getImageUrl(deal.image_url) }} style={styles.cardImage} />
                        {discountPercent > 0 && (
                          <View style={styles.badgeTopRightGreen}>
                            <Text style={styles.badgeTopRightText}>ลด {discountPercent}%</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.cardBody}>
                        <View style={styles.cardTitleRow}>
                          <Text style={styles.shopCardTitle} numberOfLines={1}>{deal.name}</Text>
                          <Text style={styles.productPriceTag}>฿{discPrice}</Text>
                        </View>
                        <Text style={styles.shopSubText}>🏬 {deal.shop_name || 'ร้านค้าพรีเมียม'}</Text>
                        <View style={styles.tagsRow}>
                          <View style={styles.smartDealBadge}>
                            <Text style={styles.smartDealBadgeText}>SMART DEAL</Text>
                          </View>
                          {deal.stock_quantity !== undefined && (
                            <View style={styles.freeDeliveryBadge}>
                              <Text style={styles.freeDeliveryBadgeText}>คงเหลือ {deal.stock_quantity} ชิ้น</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        ) : loading ? (
          <ActivityIndicator color="#16a34a" style={{ marginVertical: 30 }} size="large" />
        ) : (
          <View style={styles.dealsList}>
            {searchResults.shops.length === 0 && searchResults.products.length === 0 && (
               <View style={{ padding: 40, alignItems: 'center' }}>
                 <MaterialIcons name="search-off" size={48} color="#cbd5e1" />
                 <Text style={{ marginTop: 12, color: '#64748b', fontSize: 16 }}>ไม่พบผลลัพธ์ที่ค้นหา</Text>
               </View>
            )}

            {/* 🏪 ร้านค้าที่พบ */}
            {searchResults.shops.length > 0 && (
              <>
                <Text style={styles.trendingHeading}>🏪 ร้านค้าที่พบ ({searchResults.shops.length})</Text>
                {searchResults.shops.map(shop => (
                  <TouchableOpacity
                    key={'s_'+shop.shop_id}
                    style={styles.dealCard}
                    onPress={() => router.push({ pathname: '/shop-profile', params: { id: shop.shop_id } })}
                  >
                    <View style={styles.cardImageWrapper}>
                      <Image source={{ uri: getImageUrl(shop.image_url) }} style={styles.cardImage} />
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.shopCardTitle}>{shop.name}</Text>
                        <View style={styles.cardRating}><MaterialIcons name="star" size={14} color="#f59e0b" /><Text style={styles.ratingNum}>{shop.rating || '5.0'}</Text></View>
                      </View>
                      <Text style={styles.shopSubText}>📍 ระยะทาง: {shop.distance || 'ใกล้คุณ'}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* 🍔 เมนูอาหารที่พบ */}
            {searchResults.products.length > 0 && (
              <>
                <Text style={[styles.trendingHeading, {marginTop: 20}]}>🍔 เมนูอาหารที่พบ ({searchResults.products.length})</Text>
                {searchResults.products.map((p) => (
                  <TouchableOpacity
                    key={'p_'+p.product_id}
                    style={styles.dealCard}
                    onPress={() => router.push({
                      pathname: '/product-detail',
                      params: { id: p.product_id }
                    })}
                  >
                    <View style={styles.cardImageWrapper}>
                      <Image source={{ uri: getImageUrl(p.image_url) }} style={styles.cardImage} />
                      {p.discount_percent > 0 && (
                        <View style={styles.badgeTopRightGreen}>
                          <Text style={styles.badgeTopRightText}>ลด {p.discount_percent}%</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.shopCardTitle}>{p.name}</Text>
                        <Text style={styles.productPriceTag}>฿{p.discount_price || p.price}</Text>
                      </View>
                      <Text style={styles.shopSubText}>🏬 {p.shop_name || 'ร้านค้าพรีเมียม'}</Text>
                      <View style={styles.tagsRow}>
                        <View style={styles.smartDealBadge}>
                          <Text style={styles.smartDealBadgeText}>SMART DEAL</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8fafc'
  },
  circleBackBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  searchBarWrapper: { paddingHorizontal: 20, marginBottom: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 13, color: '#0f172a' },
  searchFilterCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  filterPillsRow: { marginBottom: 16 },
  pillBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  pillBtnActive: { backgroundColor: '#1e7a32', borderColor: '#1e7a32' },
  pillText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  pillTextActive: { color: '#fff', fontWeight: 'bold' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  recentSection: { marginBottom: 20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionHeading: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  clearAllText: { fontSize: 13, color: '#16a34a', fontWeight: '600' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6
  },
  recentChipText: { fontSize: 12, color: '#334155', fontWeight: '500' },
  trendingHeading: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 14 },
  dealsList: { gap: 16 },
  dealCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8
  },
  cardImageWrapper: { width: '100%', height: 170, position: 'relative', backgroundColor: '#f1f5f9' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  badgeTopRightGreen: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#16a34a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  badgeTopRightText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  cardBody: { padding: 14 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shopCardTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', flex: 1, marginRight: 8 },
  productPriceTag: { fontSize: 16, fontWeight: 'bold', color: '#16a34a' },
  cardRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingNum: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
  shopSubText: { fontSize: 12, color: '#64748b', marginTop: 3, marginBottom: 10 },
  tagsRow: { flexDirection: 'row', gap: 6 },
  smartDealBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  smartDealBadgeText: { color: '#15803d', fontSize: 10, fontWeight: 'bold' },
  freeDeliveryBadge: { backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  freeDeliveryBadgeText: { color: '#0369a1', fontSize: 10, fontWeight: 'bold' },
  nearbySection: { marginBottom: 10 },
  nearbyCard: {
    width: 150,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8
  },
  nearbyImage: { width: '100%', height: 96, resizeMode: 'cover', backgroundColor: '#f1f5f9' },
  nearbyCardBody: { padding: 10 },
  nearbyShopTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  nearbySubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8 },
  ratingNumSmall: { fontSize: 12, fontWeight: 'bold', color: '#0f172a', marginLeft: 2 },
  nearbyDistance: { fontSize: 11, color: '#64748b', marginLeft: 6 },
  nearbyBadgeRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' }
});