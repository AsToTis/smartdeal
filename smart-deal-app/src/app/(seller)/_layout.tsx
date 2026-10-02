import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SellerLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 85 : 65,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'หน้าหลัก',
          tabBarIcon: ({ color }) => <MaterialIcons name="dashboard" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'สินค้า',
          tabBarIcon: ({ color }) => <MaterialIcons name="inventory-2" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'คำสั่งซื้อ',
          tabBarIcon: ({ color }) => <MaterialIcons name="receipt-long" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'กระเป๋า',
          tabBarIcon: ({ color }) => <MaterialIcons name="account-balance-wallet" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'ตั้งค่า',
          tabBarIcon: ({ color }) => <MaterialIcons name="settings" size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="register-shop"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle: { display: 'none' }
        }}
      />
      <Tabs.Screen
        name="add-product"
        options={{
          href: null,
          headerShown: false
        }}
      />
      <Tabs.Screen
        name="edit-product"
        options={{
          href: null,
          headerShown: false
        }}
      />
      <Tabs.Screen
        name="order-details"
        options={{
          href: null,
          headerShown: false
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          headerShown: false
        }}
      />
    </Tabs>
  );
}
