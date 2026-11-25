const fs = require('fs');

const file = 'src/app/payment.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const downloadRes = await FileSystem\.downloadAsync\(qrUrl, filename\);[\s\S]*?if \(await Sharing\.isAvailableAsync\(\)\) {[\s\S]*?await Sharing\.shareAsync\(downloadRes\.uri\);[\s\S]*?} else {/s;

const newCode = `      // Extract base64 data
      const base64Data = qrUrl.includes(',') ? qrUrl.split(',')[1] : qrUrl;
      
      // Write base64 to file
      await FileSystem.writeAsStringAsync(filename, base64Data, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filename);
      } else {`;

if (content.match(regex)) {
  content = content.replace(regex, newCode);
  fs.writeFileSync(file, content);
  console.log('Patched correctly');
} else {
  console.log('Regex did not match');
}
