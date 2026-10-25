import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { detailOf, useCart, useRemoveFromCart, useSetCartQuantity } from '../../api/hooks';
import type { CartLine } from '../../api/types';
import { Button } from '../../components/Button';
import { QtyStepper } from '../../components/QtyStepper';
import { formatINR } from '../../format';
import { colors, radius, shadow, type } from '../../theme';
import { showDialog } from '../../dialog';

export default function CartScreen() {
  const cart = useCart();
  const setQty = useSetCartQuantity();
  const remove = useRemoveFromCart();

  if (cart.isLoading) {
    return <View style={styles.screen} />;
  }

  const data = cart.data;
  if (!data?.store) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.emptyTitle}>Pick a store first</Text>
        <Text style={styles.emptyBody}>Your cart is kept per store, so choose where you’re shopping to start one.</Text>
        <Button label="Choose a store" onPress={() => router.push('/stores')} style={styles.emptyCta} />
      </View>
    );
  }

  if (data.items.length === 0) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.emptyTitle}>Your bag is empty</Text>
        <Text style={styles.emptyBody}>Add a few things from {data.store.name.replace('Smart Grocer · ', '')} and they’ll show up here.</Text>
        <Button label="Browse the shelves" onPress={() => router.navigate('/')} style={styles.emptyCta} />
      </View>
    );
  }

  const remaining = data.free_delivery_threshold_cents - data.subtotal_cents;
  const progress = Math.min(data.subtotal_cents / data.free_delivery_threshold_cents, 1);

  function changeQty(line: CartLine, next: number) {
    if (next === 0) {
      remove.mutate(line.product.id, { onError: (err) => showDialog('Couldn’t remove that', detailOf(err).message) });
      return;
    }
    setQty.mutate(
      { productId: line.product.id, quantity: next },
      { onError: (err) => showDialog('Can’t change quantity', detailOf(err).message) },
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.storeLabel}>Shopping at {data.store.name.replace('Smart Grocer · ', '')}</Text>
          <Text style={styles.count}>{data.item_count} {data.item_count === 1 ? 'item' : 'items'}</Text>
        </View>

        <View style={styles.deliveryCard}>
          <Text style={styles.deliveryTitle}>
            {remaining > 0 ? `Add ${formatINR(remaining)} for free delivery` : 'Free delivery unlocked'}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        <View style={styles.list}>
          {data.items.map((line) => (
            <View key={line.product.id} style={styles.row}>
              <View style={[styles.thumb, { backgroundColor: line.product.bg_color }]}>
                <Text style={styles.thumbEmoji}>{line.product.emoji}</Text>
              </View>
              <View style={styles.rowBody}>
                <Pressable accessibilityRole="link" onPress={() => router.push(`/product/${line.product.id}`)}>
                  <Text style={styles.name} numberOfLines={2}>{line.product.name}</Text>
                </Pressable>
                <Text style={styles.unit}>{line.product.unit} · {formatINR(line.product.price_cents)} each</Text>
                <View style={styles.rowFoot}>
                  <QtyStepper
                    size="sm"
                    value={line.quantity}
                    max={line.product.availability?.available ?? 99}
                    disabled={setQty.isPending || remove.isPending}
                    itemName={line.product.name}
                    onChange={(next) => changeQty(line, next)}
                  />
                  <Text style={styles.lineTotal}>{formatINR(line.line_total_cents)}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.summary}>
          <SummaryRow label="Subtotal" value={formatINR(data.subtotal_cents)} />
          <SummaryRow
            label="Delivery"
            value={data.delivery_fee_cents === 0 ? 'Free' : formatINR(data.delivery_fee_cents)}
          />
          <View style={styles.divider} />
          <SummaryRow label="Total" value={formatINR(data.total_cents)} strong />
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button label={`Checkout · ${formatINR(data.total_cents)}`} onPress={() => router.push('/checkout')} />
      </View>
    </View>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle: { ...type.display, fontSize: 28, textAlign: 'center' },
  emptyBody: { ...type.body, color: colors.inkSoft, textAlign: 'center' },
  emptyCta: { marginTop: 12, alignSelf: 'stretch' },
  content: { padding: 16, paddingTop: 60, paddingBottom: 140, gap: 16 },
  header: { gap: 2 },
  storeLabel: { ...type.small, fontWeight: '600' },
  count: { ...type.display, fontSize: 30, lineHeight: 34 },
  deliveryCard: {
    backgroundColor: colors.leafSoft,
    borderRadius: radius.card,
    padding: 16,
    gap: 12,
  },
  deliveryTitle: { ...type.heading, color: colors.leaf },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.leaf },
  list: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, overflow: 'hidden' },
  row: { flexDirection: 'row', padding: 14, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  thumb: { width: 72, height: 72, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  thumbEmoji: { fontSize: 36 },
  rowBody: { flex: 1, gap: 4 },
  name: { ...type.heading, fontSize: 15 },
  unit: { ...type.small, fontSize: 12 },
  rowFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  lineTotal: { ...type.price },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 16,
    gap: 10,
    ...shadow,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { ...type.body, color: colors.inkSoft },
  summaryValue: { ...type.body, fontVariant: ['tabular-nums'] },
  strong: { ...type.heading, fontSize: 17, color: colors.ink },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginVertical: 4 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
});
