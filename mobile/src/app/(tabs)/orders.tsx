import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useOrders } from '../../api/hooks';
import type { Order } from '../../api/types';
import { Chip } from '../../components/Chip';
import { formatDay, formatINR, STATUS_LABEL } from '../../format';
import { colors, radius, type } from '../../theme';

type Scope = 'active' | 'past';

export default function OrdersScreen() {
  const [scope, setScope] = useState<Scope>('active');
  const orders = useOrders(scope);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <View style={styles.tabs}>
          <Chip label="On the way" selected={scope === 'active'} onPress={() => setScope('active')} />
          <Chip label="Past orders" selected={scope === 'past'} onPress={() => setScope('past')} />
        </View>
      </View>

      <FlatList
        data={orders.data ?? []}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => { void orders.refetch(); }} tintColor={colors.leaf} />}
        renderItem={({ item }) => <OrderCard order={item} />}
        ListEmptyComponent={
          orders.isLoading ? (
            <ActivityIndicator style={styles.loader} color={colors.leaf} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{scope === 'active' ? 'Nothing on the way' : 'No past orders yet'}</Text>
              <Text style={styles.emptyBody}>
                {scope === 'active'
                  ? 'Orders you place show up here with live tracking.'
                  : 'Delivered and cancelled orders are kept here for reference.'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

export function statusTone(status: string): { bg: string; fg: string } {
  if (status === 'delivered') return { bg: colors.leafSoft, fg: colors.leaf };
  if (status === 'cancelled' || status === 'expired') return { bg: colors.dangerSoft, fg: colors.danger };
  if (status === 'pending_payment') return { bg: colors.tomatoSoft, fg: colors.tomato };
  return { bg: colors.paperDeep, fg: colors.ink };
}

function OrderCard({ order }: { order: Order }) {
  const tone = statusTone(order.status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.order_number}, ${STATUS_LABEL[order.status]}`}
      onPress={() => router.push(`/order/${order.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.orderNo}>{order.order_number}</Text>
          <Text style={styles.meta}>
            {formatDay(order.created_at)} · {order.item_count} {order.item_count === 1 ? 'item' : 'items'} · {order.store_city}
          </Text>
        </View>
        <View style={[styles.pill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.pillText, { color: tone.fg }]}>{STATUS_LABEL[order.status] ?? order.status}</Text>
        </View>
      </View>
      <View style={styles.thumbs}>
        {order.items.slice(0, 5).map((item) => (
          <Text key={item.product_id} style={styles.thumb}>
            {item.emoji}
          </Text>
        ))}
        {order.items.length > 5 ? <Text style={styles.more}>+{order.items.length - 5}</Text> : null}
      </View>
      <Text style={styles.total}>{formatINR(order.total_cents)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, gap: 14 },
  title: { ...type.display },
  tabs: { flexDirection: 'row', gap: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  pressed: { opacity: 0.9 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 16,
    gap: 12,
  },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  orderNo: { ...type.heading, fontSize: 16 },
  meta: { ...type.small, fontSize: 12 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { ...type.micro, fontWeight: '700' },
  thumbs: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thumb: { fontSize: 22 },
  more: { ...type.small, marginLeft: 4 },
  total: { ...type.price, fontSize: 17 },
  loader: { marginTop: 48 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8, paddingHorizontal: 24 },
  emptyTitle: { ...type.title, fontSize: 20, textAlign: 'center' },
  emptyBody: { ...type.small, textAlign: 'center' },
});
