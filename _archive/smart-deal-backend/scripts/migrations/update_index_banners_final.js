const fs = require('fs');
let code = fs.readFileSync('c:/smartdeal/smart-deal-app/src/app/(tabs)/index.tsx', 'utf8');

// The regex will match from `{/* Hero Banner (Dynamic Carousel) */}` to the end of `</View>` for bannerContainer.
const uiTargetRegex = /\{\/\* Hero Banner \(Dynamic Carousel\) \*\/\}\s*<View style=\{styles\.bannerContainer\}>[\s\S]*?<\/View>\s*<\/View>/m;

const uiReplace = `{/* Hero Banner (Dynamic Carousel) */}
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
            ) : null}
          </View>`;

code = code.replace(uiTargetRegex, uiReplace);

// State rename: bannerList
code = code.replace(/const \[banners, setBanners\] = useState<any\[\]>\(\[\]\);/g, `const [bannerList, setBannerList] = useState<any[]>([]);\n  const banners = bannerList; // Alias for compatibility`);
code = code.replace(/setBanners\(/g, `setBannerList(`);

fs.writeFileSync('c:/smartdeal/smart-deal-app/src/app/(tabs)/index.tsx', code);
console.log('done updating index.tsx banner logic');
