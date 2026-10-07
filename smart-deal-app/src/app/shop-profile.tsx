import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import axios from 'axios';
import { BASE_URL } from '../constants/api';

export default function ShopProfileScreen() {
  const params = useLocalSearchParams();
  const shopId = params.id || 1; 
  
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getImageUrl = (url: string) => {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300';
    }
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `${BASE_URL.replace('/api', '')}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const fetchShopData = async () => {
    try {
      const [shopRes, productsRes] = await Promise.all([
        axios.get(`${BASE_URL}/shops/${shopId}`).catch(err => {
          console.log('Fetch shop error:', err.message);
          return { data: { success: false, shop: null } };
        }),
        axios.get(`${BASE_URL}/shops/${shopId}/products`).catch(err => {
          console.log('Fetch shop products error:', err.message);
          return { data: { success: false, products: [] } };
        })
      ]);
      
      if (shopRes.data?.success && shopRes.data?.shop) {
        setShop(shopRes.data.shop);
      }
      if (productsRes.data?.success && Array.isArray(productsRes.data?.products)) {
        setProducts(productsRes.data.products);
      }
    } catch (error) {
      console.error('Error fetching shop profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchShopData();
    }, [shopId])
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={{ marginTop: 12, color: '#64748b' }}>กำลังโหลดข้อมูลร้านค้า...</Text>
      </SafeAreaView>
    );
  }

  const isShopOpen = shop?.is_open === 1 || shop?.is_open === true || shop?.is_open === undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. Header Navigation Bar */}
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

        <Text style={styles.headerTitle}>รายละเอียดร้านค้า</Text>
        
        <TouchableOpacity 
          style={styles.circleBackBtn} 
          onPress={() => router.push('/(tabs)/search')}
          activeOpacity={0.7}
        >
          <MaterialIcons name="search" size={22} color="#16a34a" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* 2. Shop Profile Info Card */}
        <View style={styles.infoCard}>
          {/* Avatar Container */}
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: getImageUrl(shop?.image_url) }} 
              style={styles.avatar} 
            />
          </View>

          <Text style={styles.shopName}>{shop?.name || 'ร้านค้าพรีเมียม'}</Text>
          
          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: isShopOpen ? '#dcfce7' : '#fee2e2' }]}>
            <Text style={[styles.statusBadgeText, { color: isShopOpen ? '#15803d' : '#b91c1c' }]}>
              {isShopOpen ? '🟢 เปิดให้บริการ' : '🔴 ปิดให้บริการชั่วคราว'}
            </Text>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialIcons name="star" size={16} color="#fbbf24" />
              <Text style={styles.statText}>{shop?.rating || '5.0'}</Text>
            </View>
            <Text style={styles.statDot}>•</Text>
            
            <View style={styles.statItem}>
              <MaterialIcons name="location-on" size={16} color="#16a34a" />
              <Text style={styles.statText}>{shop?.distance || 'ใกล้คุณ'}</Text>
            </View>

            {shop?.owner_name && (
              <>
                <Text style={styles.statDot}>•</Text>
                <Text style={styles.statText}>เจ้าของ: {shop.owner_name}</Text>
              </>
            )}
          </View>

          {/* Address Box */}
          <View style={styles.addressBox}>
            <MaterialIcons name="place" size={16} color="#64748b" style={{ marginTop: 2, marginRight: 6 }} />
            <Text style={styles.addressText}>
              {shop?.address || 'ที่อยู่ร้านค้ายังไม่ได้ระบุ'}
            </Text>
          </View>
        </View>

        {/* 3. Products Section */}
        <View style={styles.productsSection}>
          <Text style={styles.sectionTitle}>สินค้าของร้าน ({products.length})</Text>
          
          {products.length === 0 ? (
            <View style={styles.emptyProductsBox}>
              <MaterialIcons name="inventory-2" size={48} color="#cbd5e1" />
              <Text style={{ marginTop: 12, color: '#64748b', fontSize: 15 }}>ยังไม่มีรายการสินค้าในร้านนี้</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {products.map(product => {
                const discPrice = product.discount_price ?? product.price ?? 0;
                const origPrice = product.original_price ?? product.price ?? 0;
                const hasDiscount = origPrice > discPrice;
                const discountPercent = product.discount_percent || (hasDiscount ? Math.round(((origPrice - discPrice) / origPrice) * 100) : 0);

                return (
                  <TouchableOpacity 
                    key={product.product_id} 
                    style={styles.productCard}
                    onPress={() => router.push({ pathname: '/product-detail', params: { id: product.product_id } })}
                    activeOpacity={0.85}
                  >
                    <View style={styles.imageWrapper}>
                      <Image source={{ uri: getImageUrl(product.image_url) }} style={styles.productImage} />
                      {discountPercent > 0 && (
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.productContent}>
                      <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceCurrent}>฿{Number(discPrice).toFixed(2)}</Text>
                        {hasDiscount && (
                          <Text style={styles.priceOriginal}>฿{Number(origPrice).toFixed(2)}</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  circleBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#dcfce7',
    marginBottom: 12,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  shopName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  statDot: {
    color: '#cbd5e1',
    marginHorizontal: 8,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  addressText: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
    lineHeight: 18,
  },
  productsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  emptyProductsBox: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  imageWrapper: {
    width: '100%',
    height: 135,
    backgroundColor: '#f1f5f9',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  productContent: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  priceCurrent: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  priceOriginal: {
    fontSize: 11,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
});
