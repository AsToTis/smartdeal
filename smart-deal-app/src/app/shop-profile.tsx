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
      {/* Header with Cover */}
      <View style={styles.coverImage}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/search')}>
              <MaterialIcons name="search" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Shop Info Card */}
        <View style={styles.infoCard}>
          <Image 
            source={{ uri: getImageUrl(shop?.image_url) }} 
            style={styles.avatar} 
          />
          <Text style={styles.shopName}>{shop?.name || 'ร้านค้าพรีเมียม'}</Text>
          
          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: isShopOpen ? '#dcfce7' : '#fee2e2' }]}>
            <Text style={[styles.statusBadgeText, { color: isShopOpen ? '#15803d' : '#b91c1c' }]}>
              {isShopOpen ? '🟢 เปิดให้บริการ' : '🔴 ปิดให้บริการชั่วคราว'}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialIcons name="star" size={16} color="#fbbf24" />
              <Text style={styles.statText}>{shop?.rating || '5.0'}</Text>
            </View>
            <Text style={styles.statDot}>•</Text>
            
            <View style={styles.statItem}>
              <MaterialIcons name="location-on" size={16} color="#94a3b8" />
              <Text style={styles.statText}>{shop?.distance || 'ใกล้คุณ'}</Text>
            </View>

            {shop?.owner_name && (
              <>
                <Text style={styles.statDot}>•</Text>
                <Text style={styles.statText}>เจ้าของ: {shop.owner_name}</Text>
              </>
            )}
          </View>

          <Text style={styles.addressText} numberOfLines={2}>
            {shop?.address || 'ที่อยู่ร้านค้ายังไม่ได้ระบุ'}
          </Text>
        </View>

        {/* Products */}
        <View style={styles.productsSection}>
          <Text style={styles.sectionTitle}>สินค้าของร้าน ({products.length})</Text>
          
          {products.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <MaterialIcons name="inventory-2" size={48} color="#cbd5e1" />
              <Text style={{ marginTop: 12, color: '#64748b', fontSize: 15 }}>ยังไม่มีรายการสินค้าในร้านนี้</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {products.map(product => {
                const discPrice = product.discount_price ?? product.price ?? 0;
                const origPrice = product.original_price ?? product.price ?? 0;
                const hasDiscount = origPrice > discPrice;

                return (
                  <TouchableOpacity 
                    key={product.product_id} 
                    style={styles.productCard}
                    onPress={() => router.push({ pathname: '/product-detail', params: { id: product.product_id } })}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: getImageUrl(product.image_url) }} style={styles.productImage} />
                    <View style={styles.productContent}>
                      <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceCurrent}>฿{discPrice}</Text>
                        {hasDiscount && (
                          <Text style={styles.priceOriginal}>฿{origPrice}</Text>
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
  coverImage: {
    height: 140,
    backgroundColor: '#2e7a32',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -40,
    zIndex: 10,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: '#fff',
    marginTop: -42,
    zIndex: 10,
    elevation: 5,
    marginBottom: 8,
    backgroundColor: '#e2e8f0',
  },
  shopName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
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
  addressText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 16,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
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
  productImage: {
    width: '100%',
    height: 130,
    backgroundColor: '#f1f5f9',
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  priceOriginal: {
    fontSize: 12,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
});
