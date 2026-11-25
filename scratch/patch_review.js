const fs = require('fs');
const file = 'c:/smartdeal/smart-deal-app/src/app/review.tsx';
let content = fs.readFileSync(file, 'utf8');

// The new logic to inject
const newLogic = `
export default function ReviewScreen() {
  const params = useLocalSearchParams();
  const orderId = params.order_id ? Number(params.order_id) : 24;

  // Multiple Shops
  const [shops, setShops] = useState<any[]>([]);
  const [shopRatings, setShopRatings] = useState<Record<number, number>>({});
  const [shopComments, setShopComments] = useState<Record<number, string>>({});
  const [shopPhotos, setShopPhotos] = useState<Record<number, boolean>>({});

  // Fallbacks
  const [productName, setProductName] = useState<string>((params.product_name as string) || 'เมนูอาหาร');
  const [orderDate, setOrderDate] = useState<string>((params.order_date as string) || 'เมื่อสักครู่');
  const [productImage, setProductImage] = useState<string>((params.product_image as string) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600');

  // Rider Details
  const [riderId, setRiderId] = useState<number | null>(params.rider_id ? Number(params.rider_id) : null);
  const [riderName, setRiderName] = useState<string>((params.rider_name as string) || '');
  const [riderVehicle, setRiderVehicle] = useState<string>((params.vehicle_plate as string) || '');
  const [hasRider, setHasRider] = useState<boolean>(true);

  // Ratings & Comments
  const [riderRating, setRiderRating] = useState<number>(5);
  const [riderComment, setRiderComment] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingInfo, setFetchingInfo] = useState<boolean>(false);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) return;
      try {
        setFetchingInfo(true);
        const res = await axios.get(\`\${BASE_URL}/orders/\${orderId}/tracking\`);
        if (res.data?.success) {
          const t = res.data;
          
          let fetchedShops = [];
          if (t.shops && t.shops.length > 0) fetchedShops = t.shops;
          else if (t.shop) fetchedShops = [t.shop];
          else if (params.shop_id) {
            fetchedShops = [{ shop_id: params.shop_id, name: params.shop_name }];
          }
          setShops(fetchedShops);

          const initRatings: Record<number, number> = {};
          fetchedShops.forEach((s: any) => initRatings[s.shop_id || 0] = 5);
          setShopRatings(initRatings);

          if (t.rider) {
            setHasRider(true);
            if (t.rider.rider_id) setRiderId(t.rider.rider_id);
            if (t.rider.name) setRiderName(t.rider.name);
            if (t.rider.vehicle_plate || t.rider.vehicle) {
              setRiderVehicle(t.rider.vehicle_plate || t.rider.vehicle);
            }
          }
        }
      } catch (e) {
        console.log('Notice: Auto-fetch order details for review:', e);
      } finally {
        setFetchingInfo(false);
      }
    };
    fetchOrderDetails();
  }, [orderId]);

  const handleSubmitReview = async () => {
    try {
      setLoading(true);
      let userId = 2;
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const u = JSON.parse(userData);
          if (u?.user_id) userId = u.user_id;
        }
      } catch (e) {}

      // Submit for all shops
      const shopsToSubmit = shops.length > 0 ? shops : [{ shop_id: params.shop_id }];
      
      for (let i = 0; i < shopsToSubmit.length; i++) {
        const s = shopsToSubmit[i];
        const sId = s.shop_id || 0;
        const isFirst = i === 0; // Rider rating is sent ONLY with the first shop's review
        
        await axios.post(\`\${BASE_URL}/reviews\`, {
          order_id: orderId,
          user_id: userId,
          shop_id: s.shop_id || null,
          rating: shopRatings[sId] || 5,
          comment: shopComments[sId] || '',
          image_url: shopPhotos[sId] ? productImage : null,
          rider_id: isFirst ? riderId : null,
          rider_rating: (hasRider && isFirst) ? riderRating : null,
          rider_comment: (hasRider && isFirst) ? riderComment : null
        });
      }

      Alert.alert(
        'รีวิวสำเร็จ ✨', 
        'ขอบคุณสำหรับการให้คะแนน! คุณได้รับโบนัสแต้ม +50 พอยท์เรียบร้อยแล้ว', 
        [
          {
            text: 'ดูรายการคำสั่งซื้อ',
            onPress: () => router.replace('/(tabs)/orders' as any)
          }
        ]
      );
    } catch (error: any) {
      console.error('Submit review error:', error);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกรีวิวได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง', [
        { text: 'ตกลง', onPress: () => router.back() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ให้คะแนนและรีวิว</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        {/* ======================================================== */}
        {/* PART 1: ร้านค้าและอาหาร (Shop & Food Rating) */}
        {/* ======================================================== */}
        {(shops.length > 0 ? shops : [{ shop_id: params.shop_id, name: params.shop_name }]).map((s: any, idx: number) => {
          const sId = s.shop_id || 0;
          return (
            <View key={sId || idx} style={[styles.reviewCard, { marginBottom: 16 }]}>
              <View style={styles.cardBadge}>
                <MaterialIcons name="storefront" size={16} color="#16a34a" />
                <Text style={styles.cardBadgeText}>รีวิวร้านค้า {shops.length > 1 ? \`(ร้านที่ \${idx+1})\` : '& เมนูอาหาร'}</Text>
              </View>

              <View style={styles.productInfoRow}>
                <Image 
                  source={{ uri: s.image_url || s.shop_image || productImage }} 
                  style={styles.foodThumb} 
                />
                <View style={styles.productDetails}>
                  <Text style={styles.foodTitle} numberOfLines={1}>{shops.length > 1 ? 'ออเดอร์จากร้าน' : productName}</Text>
                  <Text style={styles.shopNameText} numberOfLines={1}>{s.name || params.shop_name || 'ร้านค้า'}</Text>
                  <Text style={styles.orderDateText}>วันที่สั่ง: {orderDate}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <Text style={styles.ratingQuestion}>รสชาติและความพึงพอใจของอาหาร</Text>

              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((starNum) => {
                  const currentShopRating = shopRatings[sId] || 5;
                  const isSelected = starNum <= currentShopRating;
                  return (
                    <TouchableOpacity
                      key={starNum}
                      style={styles.starCol}
                      onPress={() => setShopRatings(prev => ({...prev, [sId]: starNum}))}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.starCircle, isSelected && styles.starCircleActive]}>
                        <MaterialIcons 
                          name={isSelected ? 'star' : 'star-border'} 
                          size={28} 
                          color={isSelected ? '#16a34a' : '#94a3b8'} 
                        />
                      </View>
                      <Text style={[styles.starNumber, isSelected && styles.starNumberActive]}>
                        {starNum}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionHeading}>ความคิดเห็นเกี่ยวกับอาหาร/ร้านค้า</Text>
              <View style={styles.textareaContainer}>
                <TextInput
                  style={styles.textarea}
                  multiline
                  placeholder="รสชาติอร่อยไหม? ปริมาณเหมาะสมและตรงปกหรือไม่..."
                  placeholderTextColor="#94a3b8"
                  value={shopComments[sId] || ''}
                  onChangeText={(val) => setShopComments(prev => ({...prev, [sId]: val}))}
                />
                <MaterialIcons name="edit" size={14} color="#cbd5e1" style={styles.textareaCornerIcon} />
              </View>

              {/* แนบรูปภาพ */}
              <TouchableOpacity 
                style={[styles.addPhotoCard, shopPhotos[sId] && styles.addPhotoCardActive]}
                onPress={() => {
                  setShopPhotos(prev => ({...prev, [sId]: !prev[sId]}));
                  Alert.alert('รูปภาพ', shopPhotos[sId] ? 'ยกเลิกการแนบรูปภาพ' : 'เพิ่มรูปภาพอาหารเรียบร้อย');
                }}
                activeOpacity={0.75}
              >
                <MaterialIcons 
                  name="add-a-photo" 
                  size={24} 
                  color="#16a34a" 
                />
                <Text style={styles.addPhotoText}>
                  {shopPhotos[sId] ? '✓ มีรูปภาพแนบแล้ว (คลิกเพื่อยกเลิก)' : 'แนบรูปภาพอาหารประกอบรีวิว'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
`;

const startIndex = content.indexOf('export default function ReviewScreen() {');
const endIndex = content.indexOf('{/* ======================================================== */\n        {/* PART 2: พนักงานส่งของ (Rider & Delivery Rating) */}');

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + newLogic + "\n        " + content.substring(endIndex);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully patched review.tsx');
} else {
  console.error('Could not find markers to patch');
}
