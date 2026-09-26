import sys

file_path = r'c:\smartdeal\smart-deal-app\src\app\tracking.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace(
    "import { WebView } from 'react-native-webview';",
    "import MapView, { Marker, Polyline } from 'react-native-maps';"
)
content = content.replace(
    "const MapWebView = WebView as any;\n",
    ""
)

# 2. Ref
content = content.replace(
    "  const webViewRef = useRef<any>(null);\n",
    ""
)

# 3. updateMapMarkers calls
content = content.replace(
    "          updateMapMarkers(res.data.shop, res.data.order, res.data.rider);\n",
    ""
)

# 4. updateMapMarkers function
start_func = content.find('  const updateMapMarkers = ')
if start_func != -1:
    end_func = content.find('  const handleCall = ', start_func)
    content = content[:start_func] + content[end_func:]

# 5. leafletMapHTML
start_html = content.find('  // HTML for Leaflet Map')
if start_html != -1:
    end_html = content.find('  if (loading) {', start_html)
    content = content[:start_html] + content[end_html:]

# 6. Map Section
old_map = '''      {/* Map Section */}
      <View style={styles.mapContainer}>
        <MapWebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: leafletMapHTML }}
          style={styles.mapWebView}
          javaScriptEnabled={true}
          scrollEnabled={false}
        />
      </View>'''

new_map = '''      {/* Map Section */}
      <View style={styles.mapContainer}>
        <MapView
          style={StyleSheet.absoluteFillObject}
          region={{
            latitude: centerLat,
            longitude: centerLng,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
        >
          {shop?.lat && order?.delivery_lat && (
            <Polyline
              coordinates={[
                { latitude: shop.lat, longitude: shop.lng },
                { latitude: order.delivery_lat, longitude: order.delivery_lng }
              ]}
              strokeColor="#16a34a"
              strokeWidth={4}
              lineDashPattern={[5, 5]}
            />
          )}

          {shop?.lat && (
            <Marker coordinate={{ latitude: shop.lat, longitude: shop.lng }} title="ร้านอาหาร">
              <View style={styles.storeMarkerCircle}>
                <Text style={{ fontSize: 16 }}>🏪</Text>
              </View>
            </Marker>
          )}

          {order?.delivery_lat && (
            <Marker coordinate={{ latitude: order.delivery_lat, longitude: order.delivery_lng }} title="จุดส่ง">
              <View style={styles.customerMarkerCircle}>
                <Text style={{ fontSize: 16 }}>📍</Text>
              </View>
            </Marker>
          )}

          {rider?.lat && (
            <Marker coordinate={{ latitude: rider.lat, longitude: rider.lng }} title="ไรเดอร์">
              <View style={styles.riderPinWrapper}>
                <View style={styles.etaTooltip}>
                  <Text style={styles.etaTooltipText}>5 นาที</Text>
                </View>
                <View style={styles.riderMarkerCircle}>
                  <Text style={{ fontSize: 16 }}>🛵</Text>
                </View>
              </View>
            </Marker>
          )}
        </MapView>
      </View>'''

content = content.replace(old_map, new_map)

# 7. Styles
old_styles = '''  mapContainer: {
    height: '40%',
    width: '100%',
    backgroundColor: '#e2e8f0'
  },'''

new_styles = '''  mapContainer: {
    height: '40%',
    width: '100%',
    backgroundColor: '#e2e8f0'
  },
  storeMarkerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f57c00',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  customerMarkerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  riderPinWrapper: {
    alignItems: 'center'
  },
  etaTooltip: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  etaTooltipText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#16a34a'
  },
  riderMarkerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },'''

content = content.replace(old_styles, new_styles)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
