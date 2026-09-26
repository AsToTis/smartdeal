const fs = require('fs');
let code = fs.readFileSync('c:/smartdeal/smart-deal-app/src/app/(tabs)/orders.tsx', 'utf8');

// Fix 1: if (!currentUserId) return
code = code.replace(
  "const res = await axios.get(`${BASE_URL}/orders/user/${currentUserId}`);",
  "if (!currentUserId) { setOrders([]); setLoading(false); setRefreshing(false); return; }\n      const res = await axios.get(`${BASE_URL}/orders/user/${currentUserId}`);"
);

// Fix 2: catch error clears array
code = code.replace(
  "} catch (error: any) {",
  "} catch (error: any) {\n      setOrders([]);"
);

fs.writeFileSync('c:/smartdeal/smart-deal-app/src/app/(tabs)/orders.tsx', code);
console.log('Fixed orders.tsx');
