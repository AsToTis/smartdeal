const fs = require('fs');

function patchRiderVisibility() {
  const file = 'src/app/tracking.tsx';
  let content = fs.readFileSync(file, 'utf8');

  // Find the Rider Info Card and wrap it in a conditional
  const riderCardRegex = /\{\/\* Rider Info Card \*\/\}\s*<View style=\{styles\.riderCard\}>([\s\S]*?)<\/View>\s*<\/View>\s*<\/ScrollView>/g;
  
  // Wait, let's just replace the fallback text with empty string and only render if rider exists.
  
  // Replace the fallbacks
  content = content.replace(/\{rider\?\.name \|\| \s*\['สมศักดิ์ สายแว้น', 'สมหวัง ส่งไว', 'วินัย ขับดี', 'สมชาย ใจดี', 'อำนาจ รวดเร็ว'\]\[\(order\?\.order_id \|\| 0\) % 5\]\s*\}/g, "{rider?.name}");
  
  content = content.replace(/\{rider\?\.vehicle_plate \|\| \s*\['กค-5555', 'ขข-9999', 'งง-1111', 'กข-1234', 'จจ-8888'\]\[\(order\?\.order_id \|\| 0\) % 5\] \+ ' \(รถจักรยานยนต์\)'\s*\}/g, "{rider?.vehicle_plate}");
  
  content = content.replace(/\{rider\?\.rating \|\| \['4\.8', '5\.0', '4\.7', '4\.9', '4\.9'\]\[\(order\?\.order_id \|\| 0\) % 5\]\}/g, "{rider?.rating}");
  
  // Wrap the rider card
  const riderCardStart = "{/* Rider Info Card */}\n          <View style={styles.riderCard}>";
  
  if (content.includes(riderCardStart) && !content.includes("{rider?.name ? (")) {
    content = content.replace(
      "{/* Rider Info Card */}\n          <View style={styles.riderCard}>",
      "{/* Rider Info Card */}\n          {rider?.name ? (\n            <View style={styles.riderCard}>"
    );
    
    // find the end of riderCard
    // It's followed by </ScrollView>
    content = content.replace(
      /<\/View>\s*<\/ScrollView>/,
      "  </View>\n          ) : (\n            <View style={[styles.riderCard, {alignItems: 'center', paddingVertical: 24}]}>\n              <MaterialCommunityIcons name=\"motorbike\" size={48} color=\"#cbd5e1\" />\n              <Text style={{marginTop: 8, color: '#64748b', fontSize: 16}}>ระบบกำลังค้นหาคนขับให้คุณ...</Text>\n            </View>\n          )}\n\n        </ScrollView>"
    );
  }

  // Also remove the fallback rider map marker if no rider
  const riderMarkerMap = /var rLat = \$\{rider\?\.lat \|\| 'null'\};\s*var rLng = \$\{rider\?\.lng \|\| 'null'\};\s*rLat = rLat \|\| \(sLat \+ 0\.001\);\s*rLng = rLng \|\| \(sLng \+ 0\.001\);/g;
  
  content = content.replace(riderMarkerMap, `var rLat = \$\{rider?.lat || 'null'\};\n            var rLng = \$\{rider?.lng || 'null'\};`);

  fs.writeFileSync(file, content);
  console.log('Patched rider visibility');
}

patchRiderVisibility();
