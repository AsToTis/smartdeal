import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../../constants/api';

const getExpiryText = (dealEndTime: string) => {
  if (!dealEndTime) return 'หมดอายุแล้ว';

  const formattedDate = dealEndTime.includes('T') 
    ? dealEndTime 
    : dealEndTime.replace(' ', 'T');

  const targetTime = new Date(formattedDate).getTime();
  const currentTime = new Date().getTime();
  const diff = targetTime - currentTime;

  if (isNaN(targetTime) || diff <= 0) return 'หมดอายุแล้ว';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `หมดอายุใน ${days} วัน ${hours} ชม.`;
  } else if (hours > 0) {
    return `หมดอายุใน ${hours} ชม. ${minutes} นาที`;
  }
  return `หมดอายุใน ${minutes} นาที`;
};

export default function SellerProductsScreen() {
  const [activeTab, setActiveTab] = useState('all'); // all, active, expired
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProducts = async () => {
    try {
      const shopId = await AsyncStorage.getItem('shop_id');
      if (!shopId) return;

      const res = await axios.get(`${BASE_URL}/shops/${shopId}/products`);
      if (res.data?.success) {
        setProducts(res.data.products);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [])
  );

  const handleDelete = (productId: number) => {
    Alert.alert('ยืนยันการลบ', 'คุณต้องการลบสินค้านี้ใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: async () => {
          try {
            const shopId = await AsyncStorage.getItem('shop_id');
            await axios.delete(`${BASE_URL}/shops/${shopId}/products/${productId}`);
            fetchProducts();
          } catch (error) {
            console.error('Error deleting product:', error);
            Alert.alert('ผิดพลาด', 'ไม่สามารถลบสินค้าได้');
          }
        }
      }
    ]);
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;

    // Simple mock logic for expired based on string matching for now
    // (Ideally checking against expiry_time from DB)
    const isExpired = p.stock_quantity === 0 || (p.deal_end_time && new Date(p.deal_end_time.replace(' ', 'T')) < new Date());

    if (activeTab === 'active') return !isExpired;
    if (activeTab === 'expired') return isExpired;
    return true;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>จัดการสินค้า</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => router.push('/(seller)/add-product')}
        activeOpacity={0.8}
      >
        <MaterialIcons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {['all', 'active', 'expired'].map((tab) => {
          const labels: any = { all: 'ทั้งหมด', active: 'ขายอยู่', expired: 'หมดอายุ' };
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{labels[tab]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94a3b8" />
        <TextInput 
          style={styles.searchInput}
          placeholder="ค้นหาสินค้าของคุณ"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView 
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProducts(); }} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#2e7a32" style={{ marginTop: 40 }} />
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inventory" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>ไม่พบรายการสินค้า</Text>
          </View>
        ) : (
          filteredProducts.map((item) => {
            const isExpired = item.stock_quantity === 0 || (item.deal_end_time && new Date(item.deal_end_time.replace(' ', 'T')) < new Date());
            return (
              <View key={item.product_id} style={[styles.productCard, isExpired && { opacity: 0.7 }]}>
                <Image source={{ uri: item.image_url || 'https://via.placeholder.com/150' }} style={styles.productImage} />
                
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                  
                  {isExpired ? (
                    <View style={styles.expiryRow}>
                      <MaterialIcons name="error" size={14} color="#ef4444" />
                      <Text style={[styles.expiryText, { color: '#ef4444' }]}>
                        {item.stock_quantity === 0 ? 'สินค้าหมด' : 'สินค้าหมดอายุแล้ว'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.expiryRow}>
                      <MaterialIcons name="schedule" size={14} color="#f97316" />
                      <Text style={styles.expiryText}>{getExpiryText(item.deal_end_time)}</Text>
                    </View>
                  )}

                  <View style={styles.priceRow}>
                    <Text style={styles.priceCurrent}>฿{item.discount_price || item.original_price}</Text>
                    {item.discount_price && item.original_price && (
                      <Text style={styles.priceOriginal}>฿{item.original_price}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.actionCol}>
                  <TouchableOpacity 
                    style={styles.editBtn}
                    onPress={() => router.push(`/(seller)/edit-product?id=${item.product_id}`)}
                  >
                    <MaterialIcons name="edit" size={18} color="#16a34a" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.product_id)}>
                    <MaterialIcons name="delete" size={18} color="#ef4444" />
                  </TouchableOpacity>
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
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2e7a32',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tabBtn: {
    paddingVertical: 16,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#2e7a32',
  },
  tabText: {
    fontSize: 15,
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
    borderRadius: 16,
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
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
  },
  productInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  expiryText: {
    fontSize: 12,
    color: '#d97706',
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  priceCurrent: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  priceOriginal: {
    fontSize: 14,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  actionCol: {
    justifyContent: 'center',
    gap: 12,
    marginLeft: 12,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
