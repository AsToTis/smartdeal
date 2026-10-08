import { Stack } from 'expo-router';
import { CartProvider } from '../context/CartContext';
import { ThemeProvider } from '../context/ThemeContext';
import { NotificationProvider } from '../context/NotificationContext';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <CartProvider>
        <NotificationProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </NotificationProvider>
      </CartProvider>
    </ThemeProvider>
  );
}