import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useCart } from '../../api/hooks';
import { colors } from '../../theme';

export default function TabsLayout() {
  const cart = useCart();
  const count = cart.data?.item_count ?? 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.leaf,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.hairline, height: 66, paddingTop: 8, paddingBottom: 12 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.tomato, color: colors.onPrimary },
          tabBarIcon: ({ color, size }) => <Ionicons name="bag-handle-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
