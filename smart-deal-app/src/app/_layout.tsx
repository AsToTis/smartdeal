import { Stack } from 'expo-router';
import { CartProvider } from '../context/CartContext';
import { ThemeProvider } from '../context/ThemeContext';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <CartProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </CartProvider>
    </ThemeProvider>
  );
}