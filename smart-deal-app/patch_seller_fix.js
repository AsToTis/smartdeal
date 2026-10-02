const fs = require('fs');

function fixSellerApp() {
  const fileDetails = 'src/app/(seller)/order-details.tsx';
  let contentDetails = fs.readFileSync(fileDetails, 'utf8');

  // Extract getImageUrl block
  const getUrlBlockRegex = /const getImageUrl = \(imgUrl: string\) => \{[\s\S]*?return `\$\{BASE_URL\.replace\('\/api', ''\)\}\$\{imgUrl\}`;[\s\n]*\};\s*/g;
  
  contentDetails = contentDetails.replace(getUrlBlockRegex, '');
  
  // Inject it right after the component declaration
  const componentDeclRegex = /export default function OrderDetailsScreen\(\) \{[\s\n]*/;
  if (contentDetails.match(componentDeclRegex)) {
    contentDetails = contentDetails.replace(componentDeclRegex, "export default function OrderDetailsScreen() {\n  const getImageUrl = (imgUrl: string) => {\n    if (!imgUrl) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';\n    if (imgUrl.startsWith('http')) return imgUrl;\n    return `${BASE_URL.replace('/api', '')}${imgUrl}`;\n  };\n\n");
  }
  fs.writeFileSync(fileDetails, contentDetails);
  console.log('Fixed order-details.tsx');

  const fileIndex = 'src/app/(seller)/index.tsx';
  let contentIndex = fs.readFileSync(fileIndex, 'utf8');

  contentIndex = contentIndex.replace(getUrlBlockRegex, '');
  
  const componentDeclIndexRegex = /export default function SellerDashboardScreen\(\) \{[\s\n]*/;
  if (contentIndex.match(componentDeclIndexRegex)) {
    contentIndex = contentIndex.replace(componentDeclIndexRegex, "export default function SellerDashboardScreen() {\n  const getImageUrl = (imgUrl: string) => {\n    if (!imgUrl) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';\n    if (imgUrl.startsWith('http')) return imgUrl;\n    return `${BASE_URL.replace('/api', '')}${imgUrl}`;\n  };\n\n");
  }

  fs.writeFileSync(fileIndex, contentIndex);
  console.log('Fixed index.tsx');
}

fixSellerApp();
