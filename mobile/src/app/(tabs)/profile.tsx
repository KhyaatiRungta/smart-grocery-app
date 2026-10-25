import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/Button';
import { useNotifications, useStores } from '../../api/hooks';
import { colors, radius, type } from '../../theme';
import { showDialog } from '../../dialog';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const stores = useStores();
  const notes = useNotifications();
  const store = stores.data?.find((s) => s.id === user?.selected_store_id);
  const initials = (user?.full_name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>You</Text>

      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name}>{user?.full_name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </View>

      <View style={styles.group}>
        <Row
          icon="storefront-outline"
          label="Your store"
          value={store ? store.name.replace('Smart Grocer · ', '') : 'Not chosen'}
          onPress={() => router.push('/stores')}
        />
        <Row
          icon="notifications-outline"
          label="Notifications"
          value={notes.data?.unread_count ? `${notes.data.unread_count} new` : 'All caught up'}
          onPress={() => router.push('/notifications')}
          last
        />
      </View>

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={18} color={colors.leaf} />
        <Text style={styles.noteText}>
          Payments and refunds in this build are simulated. No real money moves, and every refund is labelled as one.
        </Text>
      </View>

      <Button
        label="Sign out"
        variant="ghost"
        onPress={() =>
          showDialog('Sign out?', 'Your cart stays saved on the server.', [
            { text: 'Stay signed in', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
          ])
        }
      />
    </ScrollView>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  last,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { opacity: 0.85 }]}
    >
      <Ionicons name={icon} size={20} color={colors.leaf} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingTop: 60, gap: 18, paddingBottom: 48 },
  title: { ...type.display },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.onPrimary, fontSize: 20, fontWeight: '800' },
  name: { ...type.title, fontSize: 20 },
  email: { ...type.small },
  group: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  rowLabel: { ...type.heading, fontSize: 15 },
  rowValue: { ...type.small, fontSize: 13 },
  note: { flexDirection: 'row', gap: 10, backgroundColor: colors.leafSoft, borderRadius: radius.md, padding: 14, alignItems: 'flex-start' },
  noteText: { ...type.small, flex: 1, color: colors.ink },
});
