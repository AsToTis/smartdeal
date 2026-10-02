const fs = require('fs');

function patchSellerApp() {
  const fileDetails = 'src/app/(seller)/order-details.tsx';
  let contentDetails = fs.readFileSync(fileDetails, 'utf8');

  // Inject getImageUrl helper before return (
  const getUrlCode = `  const getImageUrl = (imgUrl: string) => {
    if (!imgUrl) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
    if (imgUrl.startsWith('http')) return imgUrl;
    return \`\${BASE_URL.replace('/api', '')}\${imgUrl}\`;
  };`;

  if (!contentDetails.includes('getImageUrl(')) {
    contentDetails = contentDetails.replace('return (', `${getUrlCode}\n\n  return (`);
  }
  
  // Replace the image source in order-details
  const oldImgDetails = /<Image source=\{\{ uri: item\.product_image \|\| 'https:\/\/via\.placeholder\.com\/60' \}\} style=\{styles\.itemImage\} \/>/g;
  if (contentDetails.match(oldImgDetails)) {
    contentDetails = contentDetails.replace(oldImgDetails, "<Image source={{ uri: getImageUrl(item.product_image || item.image_url) }} style={styles.itemImage} />");
  }

  fs.writeFileSync(fileDetails, contentDetails);
  console.log('Patched order-details.tsx');

  const fileIndex = 'src/app/(seller)/index.tsx';
  let contentIndex = fs.readFileSync(fileIndex, 'utf8');

  if (!contentIndex.includes('getImageUrl(')) {
    contentIndex = contentIndex.replace('return (', `${getUrlCode}\n\n  return (`);
  }

  const oldImgIndex = /<Image \s*source=\{\{ uri: item\.image_url \|\| 'https:\/\/images\.unsplash\.com\/photo-1546069901-ba9599a7e63c\?w=100' \}\}\s*style=\{styles\.recentOrderImg\}\s*\/>/g;
  if (contentIndex.match(oldImgIndex)) {
    contentIndex = contentIndex.replace(oldImgIndex, "<Image source={{ uri: getImageUrl(item.image_url || item.product_image) }} style={styles.recentOrderImg} />");
  }

  fs.writeFileSync(fileIndex, contentIndex);
  console.log('Patched index.tsx');
}

patchSellerApp();
