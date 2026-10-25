import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useMarkAllNotificationsRead, useNotifications } from '../api/hooks';
import { formatDay, formatTime } from '../format';
import { colors, radius, type } from '../theme';

export default function NotificationsScreen() {
  const notes = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const unread = notes.data?.unread_count ?? 0;

  useEffect(() => {
    if (unread > 0 && !markAll.isPending) markAll.mutate();
    // Mark once when the feed opens; the count refreshes from the server afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread > 0]);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={notes.data?.items ?? []}
      keyExtractor={(n) => String(n.id)}
      ListEmptyComponent={
        notes.isLoading ? (
          <ActivityIndicator color={colors.leaf} />
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No updates yet</Text>
            <Text style={styles.emptyBody}>Order progress lands here, even when push is off.</Text>
          </View>
        )
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => item.order_id && router.push(`/order/${item.order_id}`)}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        >
          <View style={[styles.dot, { opacity: item.read ? 0 : 1 }]} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.time}>
              {formatDay(item.created_at)} · {formatTime(item.created_at)}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.tomato, marginTop: 7 },
  title: { ...type.heading, fontSize: 15 },
  body: { ...type.small, color: colors.inkSoft },
  time: { ...type.micro },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { ...type.title, fontSize: 20 },
  emptyBody: { ...type.small, textAlign: 'center' },
});
