const fs = require('fs');

function patchSaveQR() {
  const file = 'src/app/payment.tsx';
  let content = fs.readFileSync(file, 'utf8');

  const oldCode = `      const downloadRes = await FileSystem.downloadAsync(qrUrl, filename);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadRes.uri);
      } else {`;

  const newCode = `      // Extract base64 data
      const base64Data = qrUrl.includes(',') ? qrUrl.split(',')[1] : qrUrl;
      
      // Write base64 to file
      await FileSystem.writeAsStringAsync(filename, base64Data, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filename);
      } else {`;

  if (content.includes('downloadAsync(qrUrl, filename)')) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(file, content);
    console.log('Patched save QR logic in payment.tsx');
  } else {
    console.log('Target not found in payment.tsx');
  }
}

patchSaveQR();
