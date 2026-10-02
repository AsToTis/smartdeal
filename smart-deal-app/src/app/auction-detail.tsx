import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, Image, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, TextInput, Modal, Share,
  Platform, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants/api';

export default function AuctionDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const rawId = params.auction_id || params.id;
  const parsedId = (rawId && rawId !== 'undefined' && rawId !== 'null' && !isNaN(Number(rawId)))
    ? Number(rawId)
    : 1;

  const [auctionId, setAuctionId] = useState<number>(parsedId);
  const [auction, setAuction] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);
  const [customBidInput, setCustomBidInput] = useState('');
  const [userId, setUserId] = useState<number>(2);
  const [userName, setUserName] = useState<string>('สมชาย ใจดี');
  const [isLiked, setIsLiked] = useState(false);

  // Live Countdown (HH : MM : SS)
  const [timeLeft, setTimeLeft] = useState({ hours: '02', minutes: '43', seconds: '44' });

  // Modal จบการประมูล (Winner / Loser)
  const [endModalVisible, setEndModalVisible] = useState(false);
  const [endResult, setEndResult] = useState<any>(null);

  useEffect(() => {
    const raw = params.auction_id || params.id;
    if (raw && raw !== 'undefined' && raw !== 'null' && !isNaN(Number(raw))) {
      setAuctionId(Number(raw));
    }
  }, [params.auction_id, params.id]);

  useEffect(() => {
    loadUser();
    fetchAuctionData();
  }, [auctionId]);

  const loadUser = async () => {
    try {
      const ud = await AsyncStorage.getItem('user');
      if (ud) {
        const u = JSON.parse(ud);
        if (u?.user_id) setUserId(u.user_id);
        if (u?.full_name) setUserName(u.full_name);
      }
    } catch (e) {}
  };

  const fetchAuctionData = async () => {
    try {
      const targetId = auctionId || 1;
      const res = await axios.get(`${BASE_URL}/auctions/${targetId}`);
      if (res.data.success) {
        setAuction(res.data.auction);
        setBids(res.data.bids || []);
      }
    } catch (e) {
      console.error('Failed to load auction:', e);
    } finally {
      setLoading(false);
    }
  };

  // Real-time Countdown Timer
  useEffect(() => {
    if (!auction?.end_time) return;

    const tick = () => {
      const now = new Date().getTime();
      const end = new Date(auction.end_time).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft({ hours: '00', minutes: '00', seconds: '00' });
        if (auction.auction_status === 'active') {
          handleAutoClose();
        }
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({
        hours: h < 10 ? `0${h}` : `${h}`,
        minutes: m < 10 ? `0${m}` : `${m}`,
        seconds: s < 10 ? `0${s}` : `${s}`,
      });
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [auction]);

  // Polling updates ทุก 4 วินาทีเพื่อความสดใหม่ของห้องประมูล
  useEffect(() => {
    const interval = setInterval(() => {
      if (auction?.auction_status === 'active') {
        fetchAuctionData();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [auctionId, auction?.auction_status]);

  // ปิดการประมูลเมื่อหมดเวลา
  const handleAutoClose = async () => {
    try {
      setAuction((prev: any) => ({ ...prev, auction_status: 'ended' }));
      const res = await axios.post(`${BASE_URL}/auctions/${auctionId}/close`);
      if (res.data.success) {
        setEndResult(res.data);
        setEndModalVisible(true);
      }
      fetchAuctionData();
    } catch (e) {
      console.error(e);
      fetchAuctionData();
    }
  };

  // ดำเนินการเสนอราคา (Quick Bid หรือ Custom Bid)
  const handlePlaceBid = async (amountToBid: number) => {
    const currentHighest = Number(auction?.current_bid || auction?.start_price || 0);

    if (isNaN(amountToBid) || amountToBid <= currentHighest) {
      Alert.alert('แจ้งเตือน', `ต้องเสนอราคามากกว่าราคาปัจจุบัน (฿${currentHighest.toLocaleString()})`);
      return;
    }

    try {
      setBidding(true);
      const res = await axios.post(`${BASE_URL}/auctions/${auctionId}/bid`, {
        user_id: userId,
        bid_amount: amountToBid
      });

      if (res.data.success) {
        Alert.alert('สำเร็จ 🎉', `เสนอราคา ฿${amountToBid.toLocaleString()} เรียบร้อยแล้ว!`);
        setCustomBidInput('');
        setAuction((prev: any) => ({ ...prev, current_bid: amountToBid }));
        if (res.data.bids) {
          setBids(res.data.bids);
        } else {
          fetchAuctionData();
        }
      }
    } catch (err: any) {
      Alert.alert('ผิดพลาด', err.response?.data?.message || 'เกิดข้อผิดพลาดในการเสนอราคา');
    } finally {
      setBidding(false);
    }
  };

  const handleQuickBid = (increment: number) => {
    const currentHighest = Number(auction?.current_bid || auction?.start_price || 0);
    const newBid = currentHighest + increment;
    handlePlaceBid(newBid);
  };

  const handleCustomBidSubmit = () => {
    const amt = parseFloat(customBidInput.replace(/[^0-9.]/g, ''));
    if (!amt || isNaN(amt)) {
      Alert.alert('แจ้งเตือน', 'กรุณาระบุยอดเงินที่ต้องการประมูล');
      return;
    }
    handlePlaceBid(amt);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🔥 ร่วมประมูลด่วน: "${auction?.title || 'ชุดซูชิรวมพรีเมียม'}" ราคาปัจจุบัน ฿${Number(auction?.current_bid || 8900).toLocaleString()} บน Smart Deal!`,
      });
    } catch (e) {}
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>กำลังเชื่อมต่อห้องประมูลสด...</Text>
      </SafeAreaView>
    );
  }

  const currentBid = Number(auction?.current_bid || auction?.start_price || 89);
  const startPrice = Number(auction?.start_price || 89);
  const originalPrice = Number(auction?.original_price || (startPrice > 0 ? Math.round(startPrice / 0.2) : 445));
  const discountPercent = Number(auction?.discount_percent || (originalPrice > startPrice ? Math.round(((originalPrice - startPrice) / originalPrice) * 100) : 80));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 1. Header Bar (Overlay Actions) */}
        <View style={styles.headerBar}>
          <TouchableOpacity 
            style={styles.navCircleBtn} 
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={22} color="#16a34a" />
          </TouchableOpacity>

          <View style={styles.headerRightGroup}>
            <TouchableOpacity 
              style={styles.navCircleBtn} 
              onPress={() => setIsLiked(!isLiked)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={isLiked ? "heart" : "heart-outline"} 
                size={20} 
                color={isLiked ? "#ef4444" : "#475569"} 
              />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.navCircleBtn} 
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Ionicons name="share-social-outline" size={20} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 130 + insets.bottom }]}
        >
          {/* 2. Hero Image + Floating Countdown Pill Container */}
          <View style={styles.heroImageContainer}>
            <Image 
              source={{ uri: auction?.image_url || 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800' }} 
              style={styles.heroImage} 
            />

            {/* Floating Pill Countdown */}
            <View style={styles.floatingCountdownBox}>
              <View style={styles.countdownLabelCol}>
                <View style={styles.countdownTitleRow}>
                  <MaterialIcons name="access-time" size={16} color="#ef4444" />
                  <Text style={styles.countdownTitleText}>สิ้นสุดใน:</Text>
                </View>
              </View>

              <View style={styles.countdownDigitsRow}>
                <Text style={styles.timerDigitOrange}>{timeLeft.hours}</Text>
                <Text style={styles.timerColonOrange}>:</Text>
                <Text style={styles.timerDigitOrange}>{timeLeft.minutes}</Text>
                <Text style={styles.timerColonOrange}>:</Text>
                <Text style={styles.timerDigitOrange}>{timeLeft.seconds}</Text>
              </View>

              <View style={styles.countdownUnitCol}>
                <Text style={styles.countdownUnitText}>ชั่วโมง : นาที : วินาที</Text>
              </View>
            </View>
          </View>

          {/* 3. Deal Tag & Rating Row */}
          <View style={styles.tagRatingRow}>
            <View style={styles.dealSpecialTag}>
              <Text style={styles.dealSpecialTagText}>ดีลพิเศษ</Text>
            </View>

            <View style={styles.ratingRow}>
              <MaterialIcons name="star" size={16} color="#f59e0b" />
              <Text style={styles.ratingText}>4.9 <Text style={styles.reviewCount}>(120 รีวิว)</Text></Text>
            </View>
          </View>

          {/* 4. Product Title & Shop Info */}
          <Text style={styles.productTitle}>{auction?.title || 'ชุดซูชิรวมพรีเมียม (ใกล้หมดอายุ)'}</Text>
          
          <View style={styles.shopLocationRow}>
            <Text style={styles.shopLocationText}>
              🏬 จำหน่ายโดย {auction?.shop_name || 'Sushiro Central World'} (0.8 km ห่างจากคุณ)
            </Text>
          </View>

          {/* 5. Price Box (ราคาดีลส่วนเกิน + ประหยัดทันที) */}
          <View style={styles.priceCardBox}>
            <View>
              <Text style={styles.priceCardSub}>ราคาดีลส่วนเกิน</Text>
              <View style={styles.priceValueRow}>
                <Text style={styles.priceCurrentGreen}>
                  ฿{startPrice.toLocaleString()}
                </Text>
                <Text style={styles.priceOriginalCross}>
                  ฿{originalPrice.toLocaleString()}
                </Text>
              </View>
            </View>

            <View style={styles.saveBadgePink}>
              <Text style={styles.saveBadgePinkText}>ประหยัดทันที</Text>
              <Text style={styles.saveBadgePinkPercent}>-{discountPercent}%</Text>
            </View>
          </View>

          {/* 6. Product Description & Bullet Points */}
          <View style={styles.descSection}>
            <Text style={styles.sectionTitle}>รายละเอียดสินค้า</Text>
            <Text style={styles.descParagraph}>
              ดื่มด่ำกับรสชาติญี่ปุ่นแท้ๆด้วยชุดซูชิรวมพรีเมียม คัดสรรวัตถุดิบนำเข้าจากญี่ปุ่น ทั้งโอโทโร่ อูนิ และโฮตาเตะ สดใหม่ทุกคำ จัดเตรียมโดยเชฟผู้เชี่ยวชาญ (ควรบริโภคทันทีเพื่อรสชาติที่ดีที่สุด)
            </Text>

            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• ความสดใหม่: ทำสดใหม่ทุกเช้า</Text>
              <Text style={styles.bulletItem}>• การจัดส่ง: ควบคุมอุณหภูมิความเย็นอย่างดี</Text>
            </View>

            {/* 2 Feature Pills */}
            <View style={styles.featureGrid}>
              <View style={styles.featurePill}>
                <Text style={{ fontSize: 20 }}>🥗</Text>
                <View>
                  <Text style={styles.featurePillSub}>ความสดใหม่</Text>
                  <Text style={styles.featurePillMain}>ทำสดใหม่ทุกเช้า</Text>
                </View>
              </View>

              <View style={styles.featurePill}>
                <Text style={{ fontSize: 20 }}>❄️</Text>
                <View>
                  <Text style={styles.featurePillSub}>การจัดส่ง</Text>
                  <Text style={styles.featurePillMain}>ควบคุมอุณหภูมิ</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 7. 🏆 ตารางการเสนอราคาล่าสุด (Live Leaderboard Card) */}
          <View style={styles.leaderboardCard}>
            <View style={styles.leaderboardHeader}>
              <View style={styles.leaderboardTitleRow}>
                <Text style={{ fontSize: 18 }}>🏆</Text>
                <Text style={styles.leaderboardTitle}>ตารางการเสนอราคาล่าสุด</Text>
              </View>
              <Text style={styles.bidsCountBadge}>({bids.length} บิด)</Text>
            </View>

            {/* Bids List */}
            <View style={styles.bidsContainer}>
              {bids.map((b, index) => {
                const isRankOne = index === 0;
                return (
                  <View 
                    key={b.bid_id || index} 
                    style={[styles.bidRow, isRankOne && styles.bidRowRankOne]}
                  >
                    <View style={styles.bidderLeft}>
                      {isRankOne ? (
                        <Text style={{ fontSize: 16 }}>👑</Text>
                      ) : (
                        <View style={styles.personIconCircle}>
                          <Ionicons name="person" size={12} color="#fff" />
                        </View>
                      )}
                      <Text style={[styles.bidderNameText, isRankOne && styles.bidderNameRankOne]}>
                        {b.bidder_name || 'ผู้เสนอราคา'}
                      </Text>
                    </View>

                    <View style={styles.bidderRight}>
                      <Text style={styles.bidTimeText}>{b.formatted_time || '15:37'}</Text>
                      <Text style={[styles.bidAmountText, isRankOne && styles.bidAmountRankOne]}>
                        ฿{Number(b.bid_amount).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

              {/* Quick Bid Buttons Row */}
              <View style={styles.quickBidSection}>
                <Text style={styles.quickBidLabel}>เสนอราคาด่วน:</Text>
                {(() => {
                  const inc1 = startPrice >= 500 ? 100 : 10;
                  const inc2 = startPrice >= 500 ? 200 : 20;
                  const inc3 = startPrice >= 500 ? 500 : 50;
                  return (
                    <View style={styles.quickButtonsRow}>
                      <TouchableOpacity 
                        style={styles.quickBtn} 
                        onPress={() => handleQuickBid(inc1)}
                        disabled={bidding}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quickBtnText}>+฿{inc1}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.quickBtn} 
                        onPress={() => handleQuickBid(inc2)}
                        disabled={bidding}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quickBtnText}>+฿{inc2}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.quickBtn} 
                        onPress={() => handleQuickBid(inc3)}
                        disabled={bidding}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quickBtnText}>+฿{inc3}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}

              {/* Custom Bid Input + Submit Button */}
              <View style={styles.customBidInputRow}>
                <View style={styles.inputBox}>
                  <Text style={styles.inputCurrencyPrefix}>฿</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="ใส่ยอดประมูลของคุณ..."
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={customBidInput}
                    onChangeText={setCustomBidInput}
                  />
                </View>

                <TouchableOpacity 
                  style={styles.bidSubmitBtn} 
                  onPress={handleCustomBidSubmit}
                  disabled={bidding}
                  activeOpacity={0.85}
                >
                  {bidding ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={14} color="#fff" />
                      <Text style={styles.bidSubmitBtnText}>ประมูล</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

        </ScrollView>

        {/* 8. Bottom Sticky Bar: Clean & Elevated with Safe Area */}
        <View style={[styles.bottomStickyBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View>
            <Text style={styles.bottomLabel}>ราคาปัจจุบันในห้องประมูล</Text>
            <Text style={styles.bottomPriceGreen}>฿{currentBid.toLocaleString()}</Text>
          </View>

          <View style={styles.liveNotifyBadge}>
            <View style={styles.livePulseDot} />
            <Text style={styles.liveNotifyText}>การแจ้งเตือนสด: เปิดใช้งานอยู่</Text>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* 9. Modal สรุปผลเมื่อจบการประมูล */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={endModalVisible}
        onRequestClose={() => setEndModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {endResult?.winner_user_id === userId ? (
              // กรณีชนะ
              <>
                <View style={styles.winnerIconCircle}>
                  <MaterialIcons name="emoji-events" size={48} color="#f59e0b" />
                </View>
                <Text style={styles.modalTitleWon}>🎉 ยินดีด้วย! คุณชนะการประมูล</Text>
                <Text style={styles.modalSubWon}>
                  คุณได้รับสิทธิ์ซื้อ "{auction?.title}" ในราคาพิเศษเพียง
                </Text>
                <Text style={styles.modalWinningPrice}>
                  ฿{Number(endResult?.win_amount || currentBid).toLocaleString()}
                </Text>
                <TouchableOpacity
                  style={styles.payNowBtn}
                  onPress={() => {
                    setEndModalVisible(false);
                    router.push({
                      pathname: '/payment',
                      params: {
                        order_id: endResult?.order_id || 1,
                        amount: endResult?.win_amount || currentBid,
                        shop_id: auction?.shop_id || 1
                      }
                    } as any);
                  }}
                >
                  <Text style={styles.payNowBtnText}>ไปชำระเงินทันที</Text>
                  <MaterialIcons name="chevron-right" size={22} color="#fff" />
                </TouchableOpacity>
              </>
            ) : (
              // กรณีไม่ชนะ
              <>
                <View style={styles.loserIconCircle}>
                  <MaterialIcons name="timer-off" size={44} color="#64748b" />
                </View>
                <Text style={styles.modalTitleLost}>⏰ หมดเวลาการประมูล</Text>
                <Text style={styles.modalSubLost}>
                  ผู้ชนะการประมูลในรอบนี้คือ "{endResult?.winner_name || 'ผู้เสนอราคาสูงสุด'}" ในราคา ฿{Number(endResult?.win_amount || currentBid).toLocaleString()}
                </Text>
                <TouchableOpacity
                  style={styles.closeModalBtn}
                  onPress={() => {
                    setEndModalVisible(false);
                    router.back();
                  }}
                >
                  <Text style={styles.closeModalBtnText}>กลับสู่หน้าหลัก</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#ffffff'
  },
  navCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerRightGroup: { flexDirection: 'row', gap: 10 },
  scrollContent: { paddingHorizontal: 20 },

  // Hero Image
  heroImageContainer: {
    width: '100%',
    height: 270,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 4,
    marginBottom: 16
  },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  // Floating Countdown
  floatingCountdownBox: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2
  },
  countdownLabelCol: { justifyContent: 'center' },
  countdownTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countdownTitleText: { fontSize: 12, fontWeight: 'bold', color: '#ef4444' },
  countdownDigitsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerDigitOrange: { fontSize: 16, fontWeight: 'bold', color: '#ea580c' },
  timerColonOrange: { fontSize: 14, fontWeight: 'bold', color: '#ea580c', marginBottom: 2 },
  countdownUnitCol: { justifyContent: 'center' },
  countdownUnitText: { fontSize: 9, color: '#64748b' },

  // Tag & Rating
  tagRatingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  dealSpecialTag: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  dealSpecialTagText: { color: '#2563eb', fontSize: 11, fontWeight: 'bold' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  reviewCount: { fontSize: 12, color: '#64748b', fontWeight: 'normal' },

  productTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', lineHeight: 26, marginBottom: 4 },
  shopLocationRow: { marginBottom: 14 },
  shopLocationText: { fontSize: 12, color: '#64748b' },

  // Price Card Box
  priceCardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  priceCardSub: { fontSize: 11, color: '#64748b', marginBottom: 2 },
  priceValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceCurrentGreen: { fontSize: 24, fontWeight: 'bold', color: '#16a34a' },
  priceOriginalCross: { fontSize: 14, color: '#94a3b8', textDecorationLine: 'line-through' },
  saveBadgePink: { backgroundColor: '#fdf2f8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignItems: 'center' },
  saveBadgePinkText: { color: '#db2777', fontSize: 10, fontWeight: 'bold' },
  saveBadgePinkPercent: { color: '#db2777', fontSize: 14, fontWeight: 'bold', marginTop: -2 },

  // Description
  descSection: { marginBottom: 18 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginBottom: 6 },
  descParagraph: { fontSize: 12, color: '#475569', lineHeight: 18, marginBottom: 8 },
  bulletList: { marginBottom: 12 },
  bulletItem: { fontSize: 12, color: '#475569', lineHeight: 20 },
  featureGrid: { flexDirection: 'row', gap: 10 },
  featurePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  featurePillSub: { fontSize: 10, color: '#64748b' },
  featurePillMain: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },

  // Leaderboard Card
  leaderboardCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#dcfce7',
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1
  },
  leaderboardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  leaderboardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leaderboardTitle: { fontSize: 15, fontWeight: 'bold', color: '#16a34a' },
  bidsCountBadge: { fontSize: 12, color: '#64748b' },

  bidsContainer: { gap: 8, marginBottom: 16 },
  bidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc'
  },
  bidRowRankOne: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  bidderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center'
  },
  bidderNameText: { fontSize: 13, color: '#334155', fontWeight: '500' },
  bidderNameRankOne: { fontWeight: 'bold', color: '#0f172a' },
  bidderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bidTimeText: { fontSize: 11, color: '#94a3b8' },
  bidAmountText: { fontSize: 14, fontWeight: 'bold', color: '#16a34a' },
  bidAmountRankOne: { fontSize: 15, fontWeight: 'bold', color: '#16a34a' },

  // Quick Bid
  quickBidSection: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 14 },
  quickBidLabel: { fontSize: 11, color: '#64748b', marginBottom: 8 },
  quickButtonsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickBtn: {
    flex: 1,
    backgroundColor: '#e0f2fe',
    paddingVertical: 9,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  quickBtnText: { color: '#0369a1', fontSize: 13, fontWeight: 'bold' },

  // Custom Bid Input
  customBidInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  inputCurrencyPrefix: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginRight: 6 },
  textInput: { flex: 1, fontSize: 13, color: '#0f172a', padding: 0 },
  bidSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14
  },
  bidSubmitBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  // Bottom Sticky Bar
  bottomStickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8
  },
  bottomLabel: { fontSize: 11, color: '#64748b' },
  bottomPriceGreen: { fontSize: 20, fontWeight: 'bold', color: '#16a34a', marginTop: 1 },
  liveNotifyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffedd5'
  },
  livePulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ea580c' },
  liveNotifyText: { fontSize: 11, color: '#c2410c', fontWeight: '600' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', backgroundColor: '#fff', borderRadius: 28, padding: 24, alignItems: 'center' },
  winnerIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  modalTitleWon: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginBottom: 6 },
  modalSubWon: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 10 },
  modalWinningPrice: { fontSize: 28, fontWeight: 'bold', color: '#16a34a', marginBottom: 20 },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 20,
    width: '100%',
    gap: 6
  },
  payNowBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  loserIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  modalTitleLost: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginBottom: 6 },
  modalSubLost: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  closeModalBtn: { backgroundColor: '#f1f5f9', paddingVertical: 12, borderRadius: 16, width: '100%', alignItems: 'center' },
  closeModalBtnText: { color: '#475569', fontSize: 14, fontWeight: 'bold' }
});
