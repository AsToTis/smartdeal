const fs = require('fs');
let code = fs.readFileSync('c:/smartdeal/smart-deal-app/src/app/(tabs)/index.tsx', 'utf8');

// 1. Imports
if (!code.includes('Linking,')) {
  code = code.replace(/import \{([^}]+)\} from 'react-native';/, "import { $1, Linking, Dimensions } from 'react-native';");
}

// 2. State
const stateTarget = `const [categories, setCategories] = useState<any[]>([]);`;
const stateReplace = `const [categories, setCategories] = useState<any[]>([]);\n  const [banners, setBanners] = useState<any[]>([]);`;
if (!code.includes('const [banners, setBanners]')) {
  code = code.replace(stateTarget, stateReplace);
}

// 3. fetchHomeData
const fetchTarget = `const [res, auctionRes] = await Promise.all([
        axios.get(\`\${BASE_URL}/home-data\`),
        axios.get(\`\${BASE_URL}/auctions/active\`).catch(() => ({ data: { active_auction: null } }))
      ]);`;
const fetchReplace = `const [res, auctionRes, bannerRes] = await Promise.all([
        axios.get(\`\${BASE_URL}/home-data\`),
        axios.get(\`\${BASE_URL}/auctions/active\`).catch(() => ({ data: { active_auction: null } })),
        axios.get(\`\${BASE_URL}/banners\`).catch(() => ({ data: { banners: [] } }))
      ]);`;
if (!code.includes('bannerRes')) {
  code = code.replace(fetchTarget, fetchReplace);
}

const stateSetTarget = `if (res.data?.success) {`;
const stateSetReplace = `if (bannerRes.data?.success || bannerRes.data?.banners) {
        setBanners(bannerRes.data.banners || []);
      }

      if (res.data?.success) {`;
if (!code.includes('setBanners(bannerRes')) {
  code = code.replace(stateSetTarget, stateSetReplace);
}

// 4. UI
const uiTargetRegex = /\{\/\* Hero Banner \*\/\}\s*<View style=\{styles\.bannerContainer\}>\s*<ImageBackground[\s\S]*?<\/View>\s*<\/ImageBackground>\s*<\/View>/m;

const uiReplace = `{/* Hero Banner (Dynamic Carousel) */}
          <View style={styles.bannerContainer}>
            {banners && banners.length > 0 ? (
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
          </View>`;

code = code.replace(uiTargetRegex, uiReplace);

fs.writeFileSync('c:/smartdeal/smart-deal-app/src/app/(tabs)/index.tsx', code);
console.log('done updating index.tsx');
