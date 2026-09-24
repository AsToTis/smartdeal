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

  const fetchShopData = async () => {
    try {
      const [shopRes, productsRes] = await Promise.all([
        axios.get(`${BASE_URL}/shops/${shopId}`),
        axios.get(`${BASE_URL}/shops/${shopId}/products`)
      ]);
      
      if (shopRes.data?.success) setShop(shopRes.data.shop);
      if (productsRes.data?.success) setProducts(productsRes.data.products);
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with Image Cover fake */}
      <View style={styles.coverImage}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn}>
              <MaterialIcons name="search" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <MaterialIcons name="share" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Shop Info Card */}
        <View style={styles.infoCard}>
          <Image 
            source={{ uri: shop?.image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300' }} 
            style={styles.avatar} 
          />
          <Text style={styles.shopName}>{shop?.name || 'ไม่มีชื่อร้าน'}</Text>
          <View style={styles.statsRow}>
            {shop?.rating ? (
              <>
                <View style={styles.statItem}>
                  <MaterialIcons name="star" size={16} color="#fbbf24" />
                  <Text style={styles.statText}>{shop.rating}</Text>
                </View>
                <Text style={styles.statDot}>•</Text>
              </>
            ) : null}
            
            {shop?.distance ? (
              <>
                <View style={styles.statItem}>
                  <MaterialIcons name="location-on" size={16} color="#94a3b8" />
                  <Text style={styles.statText}>{shop.distance}</Text>
                </View>
                <Text style={styles.statDot}>•</Text>
              </>
            ) : null}
            
            <Text style={styles.statText}>{shop?.opening_hours ? `เปิด ${shop.opening_hours}` : 'ไม่ได้ระบุเวลา'}</Text>
          </View>
          <Text style={styles.addressText} numberOfLines={2}>
            {shop?.address || 'ไม่ได้ระบุที่อยู่'}
          </Text>
        </View>

        {/* Products */}
        <View style={styles.productsSection}>
          <Text style={styles.sectionTitle}>สินค้าของร้าน</Text>
          
          <View style={styles.grid}>
            {products.map(product => (
              <TouchableOpacity 
                key={product.product_id} 
                style={styles.productCard}
                onPress={() => router.push({ pathname: '/product-detail', params: { id: product.product_id } })}
              >
                <Image source={{ uri: product.image_url }} style={styles.productImage} />
                <View style={styles.productContent}>
                  <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceCurrent}>฿{product.discount_price || product.original_price}</Text>
                    {product.discount_price && (
                      <Text style={styles.priceOriginal}>฿{product.original_price}</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
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
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    marginTop: -40,
    zIndex: 10,
    elevation: 5,
    marginBottom: 12,
  },
  shopName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
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
    paddingHorizontal: 20,
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
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  productImage: {
    width: '100%',
    height: 140,
  },
  productContent: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
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
