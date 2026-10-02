import React, { useEffect, useState, useCallback } from 'react';
import {  
  StyleSheet, Text, View, TextInput, ScrollView, 
  TouchableOpacity, Image, ActivityIndicator, ImageBackground, Alert, Modal 
, Linking, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../constants/api';
import { useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';

// โครงสร้างการจัดสีและไอคอนตามแต่ละหมวดหมู่ (Pastel Theme)
interface CategoryStyle {
  iconType: 'mco' | 'fa5' | 'mat';
  iconName: string;
  iconColor: string;
  bgColor: string;
  activeBgColor: string;
}

const CATEGORY_CONFIGS: Record<string, CategoryStyle> = {
  'เบเกอรี่': {
    iconType: 'mco',
    iconName: 'food-croissant',
    iconColor: '#16a34a',
    bgColor: '#dcfce7',
    activeBgColor: '#16a34a',
  },
  'อาหารมื้อหลัก': {
    iconType: 'mco',
    iconName: 'silverware-fork-knife',
    iconColor: '#2563eb',
    bgColor: '#dbeafe',
    activeBgColor: '#2563eb',
  },
  'ผลไม้': {
    iconType: 'mco',
    iconName: 'fruit-citrus',
    iconColor: '#ea580c',
    bgColor: '#ffedd5',
    activeBgColor: '#ea580c',
  },
  'เครื่องดื่ม': {
    iconType: 'mco',
    iconName: 'coffee-outline',
    iconColor: '#9333ea',
    bgColor: '#f3e8ff',
    activeBgColor: '#9333ea',
  },
  'ขนมหวาน': {
    iconType: 'mco',
    iconName: 'cake-variant-outline',
    iconColor: '#db2777',
    bgColor: '#fce7f3',
    activeBgColor: '#db2777',
  }
};

const getCategoryConfig = (categoryName: string): CategoryStyle => {
  if (categoryName && CATEGORY_CONFIGS[categoryName]) {
    return CATEGORY_CONFIGS[categoryName];
  }
  return {
    iconType: 'mco',
    iconName: 'food',
    iconColor: '#16a34a',
    bgColor: '#e8f5e9',
    activeBgColor: '#16a34a',
  };
};

const renderCategoryIcon = (categoryName: string, isSelected: boolean) => {
  const config = getCategoryConfig(categoryName);
  const color = isSelected ? '#ffffff' : config.iconColor;

  if (config.iconType === 'mco') {
    return <MaterialCommunityIcons name={config.iconName as any} size={28} color={color} />;
  } else if (config.iconType === 'fa5') {
    return <FontAwesome5 name={config.iconName as any} size={24} color={color} />;
  }
  return <MaterialIcons name={config.iconName as any} size={28} color={color} />;
};

// ฟังก์ชันคำนวณเวลาถอยหลังแบบ Dynamic จาก deal_end_time
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

export default function HomeScreen() {
  const { addToCart, totalCount } = useCart();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [bannerList, setBannerList] = useState<any[]>([]);
  const banners = bannerList; // Alias for compatibility
  const [deals, setDeals] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [activeAuction, setActiveAuction] = useState<any>(null);
  const { colors, isDark } = useTheme();
  
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [userAddress, setUserAddress] = useState<any>(null);

  // State สำหรับควบคุม Modal แจ้งเตือน
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState('');

  const fetchUnreadNotifications = async () => {
    try {
      let currentUserId = null;
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const u = JSON.parse(userData);
        if (u?.user_id) currentUserId = u.user_id;
      }
      const res = await axios.get(`${BASE_URL}/notifications/unread-count/${currentUserId}`);

      if (res.data?.success) {
        setUnreadNotifications(res.data.count ?? res.data.unread_count ?? 0);
      }
    } catch (e) {
      // Ignored
    }
  };

  const fetchUserAddress = async () => {
    try {
      let currentUserId = null;
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const u = JSON.parse(userData);
        if (u?.user_id) currentUserId = u.user_id;
      }
      const res = await axios.get(`${BASE_URL}/users/${currentUserId}/address`);
      if (res.data) {
        setUserAddress(res.data);
      }
    } catch (e) {
      // Ignored
    }
  };

  const fetchHomeData = async () => {
    try {
      const [res, auctionRes, bannerRes] = await Promise.all([
        axios.get(`${BASE_URL}/home-data`),
        axios.get(`${BASE_URL}/auctions/active`).catch(() => ({ data: { active_auction: null } })),
        axios.get(`${BASE_URL}/banners`).catch(() => ({ data: { banners: [] } }))
      ]);

      if (res.data?.success) {
        setCategories(res.data.categories || []);
        setDeals(res.data.deals || []);
        setShops(res.data.shops || []);
      }

      if (auctionRes.data?.active_auction) {
        setActiveAuction(auctionRes.data.active_auction);
      } else {
        setActiveAuction(null);
      }

      if (bannerRes.data?.success || bannerRes.data?.banners) {
        setBannerList(bannerRes.data.banners || []);
      }

      await Promise.all([
        fetchUnreadNotifications(),
        fetchUserAddress()
      ]);
    } catch (err) {
      console.error('Failed to load data from Database:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHomeData();
      fetchUnreadNotifications();
      fetchUserAddress();
    }, [])
  );

  const handleSelectProduct = (item: any) => {
    router.push({
      pathname: '/product-detail' as any,
      params: {
        id: item.product_id,
        title: item.name,
        price: item.discount_price || item.price,
        originalPrice: item.original_price,
        discount: `-${item.discount_percent}%`,
        image: item.image_url,
        stock_quantity: item.stock_quantity ?? 5,
        shop_id: item.shop_id || 1,
        shop_name: item.shop_name || 'ร้านค้าพรีเมียม'
      }
    });
  };

  const filteredDeals = deals.filter((item) => {
    let matchCat = true;
    if (selectedCategory) {
      matchCat = (
        item.category_id === selectedCategory || 
        item.category_name === selectedCategory || 
        item.category === selectedCategory
      );
    }
    let matchSearch = true;
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      matchSearch = (item.name && item.name.toLowerCase().includes(keyword)) ||
                    (item.shop_name && item.shop_name.toLowerCase().includes(keyword));
    }
    return matchCat && matchSearch;
  });

  return (
    <SafeAreaView style={[styles.container, isDark && { backgroundColor: '#0f172a' }]}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2e7a32" />
          <Text style={{ marginTop: 10, color: isDark ? '#94a3b8' : '#666' }}>กำลังดึงข้อมูลสินค้าล่าสุด...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          
          {/* Header & Location */}
          <View style={[styles.headerContainer, isDark && { backgroundColor: '#1e293b' }]}>
            <View style={styles.locationRow}>
              <TouchableOpacity 
                style={styles.locationInfo} 
                onPress={() => router.push('/address' as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.locIconBg, isDark && { backgroundColor: '#334155' }]}>
                  <MaterialIcons name="location-on" size={20} color={isDark ? '#4ade80' : '#2e7a32'} />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.locationLabel, isDark && { color: '#94a3b8' }]}>ส่งไปที่</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.locationName, { flexShrink: 1 }, isDark && { color: '#f8fafc' }]} numberOfLines={1}>
                      {userAddress?.title 
                        ? (userAddress.address_detail 
                            ? `${userAddress.title} - ${userAddress.address_detail.split(' ')[0]}`
                            : userAddress.title)
                        : 'กำหนดที่อยู่จัดส่ง'}
                    </Text>
                    <MaterialIcons name="keyboard-arrow-down" size={18} color={isDark ? '#f8fafc' : '#333'} />
                  </View>
                </View>
              </TouchableOpacity>

              {/* ไอคอนตะกร้าพร้อมตัวเลข Badge แจ้งเตือน */}
              <View style={styles.headerIcons}>
                <TouchableOpacity style={[styles.iconBtn, isDark && { backgroundColor: '#334155' }]} onPress={() => router.push('/cart')}>
                  <MaterialIcons name="shopping-cart" size={20} color={isDark ? '#f8fafc' : '#555'} />
                  {totalCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{totalCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.iconBtn, isDark && { backgroundColor: '#334155' }]} 
                  onPress={() => router.push('/notifications' as any)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="notifications" size={20} color={isDark ? '#f8fafc' : '#555'} />
                  {unreadNotifications > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadNotifications > 99 ? '99+' : unreadNotifications}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Search Bar */}
            <View style={[styles.searchBar, isDark && { backgroundColor: '#334155' }]}>
              <MaterialIcons name="search" size={20} color={isDark ? '#94a3b8' : '#999'} />
              <TextInput 
                style={[styles.searchInput, isDark && { color: '#f8fafc' }]} 
                placeholder="ค้นหาอาหารส่วนเกินแสนอร่อย..." 
                placeholderTextColor={isDark ? '#94a3b8' : '#999'} 
                value={searchKeyword}
                onChangeText={setSearchKeyword}
              />
              {searchKeyword.length > 0 && (
                <TouchableOpacity onPress={() => setSearchKeyword('')}>
                  <MaterialIcons name="close" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Hero Banner (Dynamic Carousel) */}
          <View style={styles.bannerContainer}>
            {loading ? (
              <View style={[styles.bannerBg, { backgroundColor: '#e2e8f0', borderRadius: 20, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="small" color="#94a3b8" />
              </View>
            ) : banners && banners.length > 0 ? (
              <ScrollView 
                horizontal 
                pagingEnabled 
                showsHorizontalScrollIndicator={false}
                style={{ width: Dimensions.get('window').width - 40, borderRadius: 20 }}
              >
                {banners.map((item, index) => (
                  <TouchableOpacity 
                    key={index} 
                    activeOpacity={0.9} 
                    style={{ width: Dimensions.get('window').width - 40 }}
                    onPress={() => {
                      if (item.link_url) Linking.openURL(item.link_url);
                    }}
                  >
                    <ImageBackground 
                      source={{ uri: item.image_url }} 
                      style={styles.bannerBg}
                      imageStyle={{ borderRadius: 20, resizeMode: 'cover' }}
                    >
                      <View style={styles.bannerOverlay}>
                        {item.badge_text ? (
                          <View style={styles.bannerBadge}>
                            <Text style={styles.bannerBadgeText}>{item.badge_text}</Text>
                          </View>
                        ) : null}
                        <Text style={styles.bannerTitle}>{item.title || ''}</Text>
                        <Text style={styles.bannerSub}>{item.subtitle || ''}</Text>
                        <View style={styles.bannerBtn}>
                          <Text style={styles.bannerBtnText}>รายละเอียด</Text>
                        </View>
                      </View>
                    </ImageBackground>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <ImageBackground 
                source={{ uri: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800' }} 
                style={styles.bannerBg}
                imageStyle={{ borderRadius: 20, resizeMode: 'cover' }}
              >
                <View style={styles.bannerOverlay}>
                  <View style={styles.bannerBadge}>
                    <Text style={styles.bannerBadgeText}>ดีลสายฟ้าแลบ</Text>
                  </View>
                  <Text style={styles.bannerTitle}>ประหยัดสูงสุด 70% กับอาหารสดส่วนเกิน!</Text>
                  <Text style={styles.bannerSub}>ช่วยลดขยะอาหารและเพลิดเพลินกับอาหารพรีเมียมในราคาสุดคุ้ม</Text>
                  <TouchableOpacity style={styles.bannerBtn}>
                    <Text style={styles.bannerBtnText}>สั่งเลย</Text>
                  </TouchableOpacity>
                </View>
              </ImageBackground>
            )}
          </View>

          {/* Categories */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>หมวดหมู่</Text>
            {selectedCategory ? (
              <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                <Text style={styles.seeAllText}>ล้างการเลือก</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => router.push('/search' as any)}>
                <Text style={styles.seeAllText}>ดูทั้งหมด</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
            {categories.map((cat, index) => {
              const catId = cat.category_id || cat.name;
              const isSelected = selectedCategory === catId;
              const config = getCategoryConfig(cat.name);

              return (
                <TouchableOpacity 
                  key={catId || index} 
                  style={styles.catCard}
                  onPress={() => setSelectedCategory(isSelected ? null : catId)}
                  activeOpacity={0.75}
                >
                  <View style={[
                    styles.catIconBox, 
                    { backgroundColor: isSelected ? config.activeBgColor : config.bgColor }
                  ]}>
                    {renderCategoryIcon(cat.name, isSelected)}
                  </View>
                  <Text style={[
                    styles.catText, 
                    isSelected && { color: config.activeBgColor, fontWeight: 'bold' }
                  ]} numberOfLines={1}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ========================================== */}
          {/* 🔥 ดีลประมูลพิเศษ (สินค้าหายาก) — LIVE */}
          {/* ========================================== */}
          {activeAuction && (
            <>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.sectionTitle}>🔥 ดีลประมูลพิเศษ (สินค้าหายาก)</Text>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                </View>
              </View>

              {/* Auction Deal Card */}
              <TouchableOpacity
                style={styles.auctionCard}
                onPress={() => router.push({
                  pathname: '/auction-detail' as any,
                  params: {
                    auction_id: activeAuction?.auction_id || 1,
                    id: activeAuction?.auction_id || 1,
                    title: activeAuction?.title || 'ชุดซูชิรวมพรีเมียม (ใกล้หมดอายุ)',
                    price: activeAuction?.current_bid || 8900
                  }
                })}
                activeOpacity={0.88}
              >
                {/* รูปสินค้าประมูล */}
                <View style={styles.auctionImgWrapper}>
                  <Image
                    source={{ uri: activeAuction?.image_url || 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600' }}
                    style={styles.auctionImg}
                  />
                  <View style={styles.auctionImgBadge}>
                    <Text style={styles.auctionImgBadgeText}>ประมูล</Text>
                  </View>
                </View>

                {/* ข้อมูลประมูล */}
                <View style={styles.auctionContent}>
                  <Text style={styles.auctionProductName} numberOfLines={1}>
                    {activeAuction?.title || 'ชุดซูชิรวมพรีเมียม (ใกล้หมดอายุ)'}
                  </Text>
                  <Text style={styles.auctionShopName}>{activeAuction?.shop_name || 'Sushiro Central World'}</Text>

                  {/* Countdown */}
                  <View style={styles.auctionCountdownRow}>
                    <MaterialIcons name="access-time" size={13} color="#f59e0b" />
                    <Text style={styles.auctionCountdownText}>
                      ⏱ เวลาเหลือ: {activeAuction?.time_remaining_text || '1 ชม. 30 นาที'}
                    </Text>
                  </View>

                  {/* ราคาประมูลสูงสุด */}
                  <Text style={styles.auctionBidLabel}>เสนอราคาสูงสุด</Text>
                  <View style={styles.auctionPriceRow}>
                    <Text style={styles.auctionBidPrice}>
                      ฿{Number(activeAuction?.current_bid || activeAuction?.start_price || 89).toLocaleString()}
                    </Text>
                    <TouchableOpacity
                      style={styles.joinAuctionBtn}
                      onPress={() => {
                        router.push({
                          pathname: '/auction-detail' as any,
                          params: { 
                            auction_id: activeAuction?.auction_id || 1,
                            id: activeAuction?.auction_id || 1,
                            title: activeAuction?.title || 'ชุดซูชิรวมพรีเมียม (ใกล้หมดอายุ)', 
                            price: activeAuction?.current_bid || 89 
                          }
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.joinAuctionBtnText}>ร่วมประมูล</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Near Expiry Deals */}
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.sectionTitle}>ดีลใกล้หมดอายุ ({filteredDeals.length})</Text>
              <View style={styles.urgentBadge}>
                <MaterialIcons name="timer" size={12} color="#f57c00" />
                <Text style={styles.urgentText}>ใกล้ปิดร้าน</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setSelectedCategory(null)}>
              <Text style={styles.seeAllText}>ดูทั้งหมด</Text>
            </TouchableOpacity>
          </View>

          {/* แสดงสินค้า */}
          {filteredDeals.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#888' }}>ไม่พบสินค้าในหมวดหมู่นี้</Text>
            </View>
          ) : (
            filteredDeals.map((item) => {
              const stock = parseInt(item.stock_quantity !== undefined && item.stock_quantity !== null ? item.stock_quantity : 5, 10);
              const isOutOfStock = stock <= 0;
              const isLowStock = stock > 0 && stock <= 3;

              return (
                <TouchableOpacity 
                  key={item.product_id} 
                  style={[styles.dealCard, isOutOfStock && styles.dealCardDisabled]}
                  onPress={() => handleSelectProduct(item)}
                  activeOpacity={0.8}
                >
                  <View style={styles.imageWrapper}>
                    <Image 
                      source={{ uri: item.image_url }} 
                      style={[styles.dealImg, isOutOfStock && styles.dealImgDisabled]} 
                    />
                    {item.discount_percent > 0 && (
                      <View style={[styles.dealTag, isOutOfStock && { backgroundColor: '#64748b' }]}>
                        <Text style={styles.dealTagText}>-{item.discount_percent}%</Text>
                      </View>
                    )}
                    {isOutOfStock && (
                      <View style={styles.soldOutOverlay}>
                        <Text style={styles.soldOutText}>สินค้าหมด</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.dealContent}>
                    <Text style={[styles.dealTitle, isOutOfStock && { color: '#94a3b8' }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    
                    {/* Expiry Badge */}
                    <Text style={styles.expiryBadge}>
                      {getExpiryText(item.deal_end_time)}
                    </Text>

                    {/* Stock Status Badge */}
                    <View style={styles.stockBadgeRow}>
                      {isOutOfStock ? (
                        <View style={styles.stockTagOut}>
                          <MaterialIcons name="block" size={11} color="#ef4444" />
                          <Text style={styles.stockTagOutText}>สินค้าหมดแล้ว</Text>
                        </View>
                      ) : isLowStock ? (
                        <View style={styles.stockTagLow}>
                          <MaterialIcons name="local-fire-department" size={11} color="#ea580c" />
                          <Text style={styles.stockTagLowText}>เหลือเพียง {stock} ชิ้นสุดท้าย!</Text>
                        </View>
                      ) : (
                        <View style={styles.stockTagNormal}>
                          <MaterialIcons name="inventory" size={11} color="#16a34a" />
                          <Text style={styles.stockTagNormalText}>เหลืออีก {stock} ชิ้น</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.shopName} numberOfLines={1}>🏬 {item.shop_name || 'ร้านค้าพรีเมียม'}</Text>
                    
                    <View style={styles.priceRow}>
                      <Text style={[styles.price, isOutOfStock && { color: '#94a3b8' }]}>
                        ฿{item.discount_price}
                      </Text>
                      {item.original_price > item.discount_price && (
                        <Text style={styles.oldPrice}>฿{item.original_price}</Text>
                      )}
                      
                      {/* ปุ่มกดเพิ่มลงตะกร้า */}
                      {isOutOfStock ? (
                        <View style={styles.disabledAddCartBtn}>
                          <MaterialIcons name="remove-shopping-cart" size={16} color="#94a3b8" />
                        </View>
                      ) : (
                        <TouchableOpacity 
                          style={styles.addCartBtn} 
                          onPress={(e) => {
                            e.stopPropagation();
                            addToCart(item, 1);
                            setSelectedProductName(item.name);
                            setShowSuccessModal(true);
                          }}
                        >
                          <MaterialIcons name="add-shopping-cart" size={16} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

        </ScrollView>
      )}

      {/* Custom Modal แจ้งเตือนเพิ่มลงตะกร้าสำเร็จ */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSuccessModal}
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIconCircle}>
              <MaterialIcons name="check" size={32} color="#fff" />
            </View>
            <Text style={styles.modalTitle}>เพิ่มลงตะกร้าเรียบร้อย!</Text>
            <Text style={styles.modalSubTitle}>
              "{selectedProductName}" จำนวน 1 ชิ้น ถูกใส่ในตะกร้าของคุณแล้ว
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity 
                style={styles.continueBtn} 
                onPress={() => setShowSuccessModal(false)}
              >
                <Text style={styles.continueBtnText}>เลือกซื้อต่อ</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.goToCartBtn} 
                onPress={() => {
                  setShowSuccessModal(false);
                  router.push('/cart');
                }}
              >
                <Text style={styles.goToCartBtnText}>ไปที่ตะกร้า</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  headerContainer: { padding: 16, backgroundColor: '#fff', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  locationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  locationInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 16 },
  locIconBg: { backgroundColor: '#e8f5e9', padding: 8, borderRadius: 20 },
  locationLabel: { fontSize: 9, color: '#888', fontWeight: 'bold', textTransform: 'uppercase' },
  locationName: { fontSize: 14, fontWeight: 'bold', color: '#111' },
  headerIcons: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  iconBtn: { padding: 8, backgroundColor: '#f0f2f0', borderRadius: 20, position: 'relative' },
  
  badge: { 
    position: 'absolute', 
    top: -2, 
    right: -2, 
    backgroundColor: '#d32f2f', 
    borderRadius: 10, 
    minWidth: 16, 
    height: 16, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 4 
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f3f1', borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { marginLeft: 8, flex: 1, fontSize: 13, color: '#333' },
  
  bannerContainer: { margin: 16, borderRadius: 20, overflow: 'hidden' },
  bannerBg: { width: '100%', height: 160 },
  bannerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', padding: 16, justifyContent: 'center' },
  bannerBadge: { backgroundColor: '#f57c00', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 6 },
  bannerBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  bannerTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', width: '80%' },
  bannerSub: { color: '#ddd', fontSize: 11, marginVertical: 4, width: '85%' },
  bannerBtn: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginTop: 6 },
  bannerBtnText: { color: '#2e7a32', fontWeight: 'bold', fontSize: 11 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  seeAllText: { color: '#2e7a32', fontSize: 12, fontWeight: 'bold' },
  urgentBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#fff3e0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  urgentText: { fontSize: 9, color: '#f57c00', fontWeight: 'bold' },

  horizontalList: { paddingLeft: 16, paddingVertical: 4 },
  catCard: { alignItems: 'center', marginRight: 16, width: 68 },
  catIconBox: { 
    width: 60, 
    height: 60, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1
  },
  catText: { fontSize: 12, fontWeight: '600', color: '#334155', textAlign: 'center' },

  dealCard: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: '#eee' },
  dealCardDisabled: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', opacity: 0.85 },
  imageWrapper: { position: 'relative' },
  dealImg: { width: 85, height: 85, borderRadius: 12 },
  dealImgDisabled: { opacity: 0.6 },
  soldOutOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  soldOutText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  dealTag: { position: 'absolute', top: 4, left: 4, backgroundColor: '#f57c00', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  dealTagText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  dealContent: { flex: 1, marginLeft: 12 },
  dealTitle: { fontSize: 14, fontWeight: 'bold', color: '#222' },
  expiryBadge: { fontSize: 9, color: '#d32f2f', fontWeight: 'bold', marginTop: 2 },
  
  // Stock Status Badges
  stockBadgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  stockTagNormal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  stockTagNormalText: { fontSize: 10, color: '#16a34a', fontWeight: 'bold' },
  stockTagLow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  stockTagLowText: { fontSize: 10, color: '#ea580c', fontWeight: 'bold' },
  stockTagOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  stockTagOutText: { fontSize: 10, color: '#ef4444', fontWeight: 'bold' },

  shopName: { fontSize: 11, color: '#666', marginTop: 4, marginBottom: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  price: { color: '#2e7a32', fontSize: 16, fontWeight: 'bold' },
  oldPrice: { color: '#aaa', fontSize: 11, textDecorationLine: 'line-through' },
  addCartBtn: { marginLeft: 'auto', backgroundColor: '#2e7a32', padding: 6, borderRadius: 8 },
  disabledAddCartBtn: { marginLeft: 'auto', backgroundColor: '#e2e8f0', padding: 6, borderRadius: 8 },

  shopCard: { width: 180, backgroundColor: '#fff', borderRadius: 16, marginRight: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  shopImg: { width: '100%', height: 95 },
  shopTitle: { fontSize: 13, fontWeight: 'bold', color: '#222' },
  shopSub: { fontSize: 10, color: '#666', marginTop: 2 },
  tagBadge: { backgroundColor: '#e8f5e9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { color: '#2e7a32', fontSize: 9, fontWeight: 'bold' },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00a651',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 6,
  },
  modalSubTitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  continueBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  continueBtnText: {
    color: '#555',
    fontSize: 14,
    fontWeight: 'bold',
  },
  goToCartBtn: {
    flex: 1,
    backgroundColor: '#00a651',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  goToCartBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // ============================================
  // 🔥 Auction Section Styles (ดีลประมูลพิเศษ)
  // ============================================
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff'
  },
  liveText: { color: '#fff', fontSize: 9, fontWeight: 'bold', letterSpacing: 1 },

  auctionCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 130,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8
  },
  auctionImgWrapper: { width: 110, height: 130, position: 'relative' },
  auctionImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  auctionImgBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  auctionImgBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },

  auctionContent: { flex: 1, padding: 12, justifyContent: 'center' },
  auctionProductName: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 },
  auctionShopName: { fontSize: 11, color: '#16a34a', fontWeight: '600', marginBottom: 6 },

  auctionCountdownRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  auctionCountdownText: { fontSize: 11, color: '#f59e0b', fontWeight: '600' },

  auctionBidLabel: { fontSize: 10, color: '#64748b', marginBottom: 2 },
  auctionPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  auctionBidPrice: { fontSize: 18, fontWeight: 'bold', color: '#16a34a' },
  joinAuctionBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16
  },
  joinAuctionBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});