import { Stack } from 'expo-router';
import { CartProvider } from '../context/CartContext'; // ตรวจสอบ Path ให้ถูกต้องตามโครงสร้างโฟลเดอร์

export default function RootLayout() {
  return (
    <CartProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </CartProvider>
  );
}