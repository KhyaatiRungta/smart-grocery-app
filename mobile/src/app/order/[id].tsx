import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { detailOf, useCancelOrder, useOrder, usePayOrder } from '../../api/hooks';
import { Button } from '../../components/Button';
import { StatusTimeline } from '../../components/StatusTimeline';
import { formatDay, formatINR, formatTime, STATUS_LABEL } from '../../format';
import { colors, radius, type } from '../../theme';
import { statusTone } from '../(tabs)/orders';
import { showDialog } from '../../dialog';

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const order = useOrder(orderId);
  const pay = usePayOrder();
  const cancel = useCancelOrder();
  const now = useNow(order.data?.status === 'pending_payment');

  if (order.isLoading || !order.data) {
    return (
      <View style={styles.center}>
        {order.isError ? <Text style={styles.body}>{detailOf(order.error).message}</Text> : <ActivityIndicator color={colors.leaf} />}
      </View>
    );
  }

  const o = order.data;
  const tone = statusTone(o.status);
  const expiresIn = o.reservation_expires_at ? Math.max(0, new Date(o.reservation_expires_at).getTime() - now) : 0;
  const mins = Math.floor(expiresIn / 60000);
  const secs = Math.floor((expiresIn % 60000) / 1000).toString().padStart(2, '0');

  function confirmCancel() {
    showDialog(
      'Cancel this order?',
      o.payment_status === 'paid_simulated'
        ? `A simulated refund of ${formatINR(o.total_cents)} will be issued.`
        : 'Reserved items go back on the shelf.',
      [
        { text: 'Keep order', style: 'cancel' },
        {
          text: 'Cancel order',
          style: 'destructive',
          onPress: () =>
            cancel.mutate(
              { orderId: o.id, reason: 'Cancelled by customer' },
              { onError: (err) => showDialog('Can’t cancel', detailOf(err).message) },
            ),
        },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.orderNo}>{o.order_number}</Text>
          <Text style={styles.heroTitle}>{STATUS_LABEL[o.status] ?? o.status}</Text>
          <View style={[styles.pill, { backgroundColor: tone.bg }]}>
            <Text style={[styles.pillText, { color: tone.fg }]}>
              {o.delivery_mode === 'pickup' ? 'Pickup' : 'Delivery'} · {o.store_name.replace('Smart Grocer · ', '')}
            </Text>
          </View>
          <Text style={styles.meta}>
            Placed {formatDay(o.created_at)} at {formatTime(o.created_at)}
          </Text>
        </View>

        {o.status === 'pending_payment' ? (
          <View style={styles.holdCard}>
            <Text style={styles.holdTitle}>Items held for {mins}:{secs}</Text>
            <Text style={styles.holdBody}>Pay before the timer ends or the stock goes back on the shelf.</Text>
            <Button
              label={`Pay ${formatINR(o.total_cents)} (simulated)`}
              loading={pay.isPending}
              onPress={() => pay.mutate(o.id, { onError: (err) => showDialog('Can’t pay', detailOf(err).message) })}
            />
          </View>
        ) : null}

        <Text style={styles.section}>Tracking</Text>
        <View style={styles.timeline}>
          <StatusTimeline status={o.status} events={o.events} />
        </View>

        <Text style={styles.section}>Items · {o.item_count}</Text>
        <View style={styles.list}>
          {o.items.map((item) => (
            <View key={item.product_id} style={styles.item}>
              <Text style={styles.itemEmoji}>{item.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={2}>{item.product_name}</Text>
                <Text style={styles.itemMeta}>
                  {item.quantity} × {item.unit} · {formatINR(item.unit_price_cents)}
                </Text>
              </View>
              <Text style={styles.itemTotal}>{formatINR(item.line_total_cents)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.summary}>
          <Line label="Subtotal" value={formatINR(o.subtotal_cents)} />
          <Line label="Delivery" value={o.delivery_fee_cents === 0 ? 'Free' : formatINR(o.delivery_fee_cents)} />
          <View style={styles.divider} />
          <Line label="Total" value={formatINR(o.total_cents)} strong />
          <Text style={styles.paymentLine}>
            {o.payment_status === 'paid_simulated'
              ? 'Paid · simulated card'
              : o.payment_status === 'refunded_simulated'
                ? `Simulated refund of ${formatINR(o.refund_cents)} issued`
                : 'Not paid yet'}
          </Text>
        </View>

        {o.delivery_mode === 'delivery' ? (
          <View style={styles.address}>
            <Text style={styles.addressLabel}>Delivering to</Text>
            <Text style={styles.addressText}>{o.address_line}, {o.city} {o.pincode}</Text>
          </View>
        ) : null}

        {o.cancel_reason ? <Text style={styles.reason}>Reason: {o.cancel_reason}</Text> : null}

        {o.cancellable ? (
          <Button label="Cancel order" variant="danger" loading={cancel.isPending} onPress={confirmCancel} />
        ) : null}
      </ScrollView>
    </View>
  );
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.lineRow}>
      <Text style={[styles.lineLabel, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.lineValue, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, padding: 24 },
  body: { ...type.body, textAlign: 'center' },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  hero: { gap: 6, paddingVertical: 4 },
  orderNo: { ...type.small, fontVariant: ['tabular-nums'], fontWeight: '600' },
  heroTitle: { ...type.display },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { ...type.micro, fontWeight: '700' },
  meta: { ...type.small },
  holdCard: { backgroundColor: colors.tomatoSoft, borderRadius: radius.card, padding: 16, gap: 8 },
  holdTitle: { ...type.heading, color: colors.tomato, fontSize: 18 },
  holdBody: { ...type.small, color: colors.ink },
  section: { ...type.heading, fontSize: 18, marginTop: 4 },
  timeline: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  list: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  itemEmoji: { fontSize: 28, width: 40, textAlign: 'center' },
  itemName: { ...type.heading, fontSize: 15 },
  itemMeta: { ...type.small, fontSize: 12 },
  itemTotal: { ...type.price },
  summary: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, padding: 16, gap: 10 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between' },
  lineLabel: { ...type.body, color: colors.inkSoft },
  lineValue: { ...type.body, fontVariant: ['tabular-nums'] },
  strong: { ...type.heading, fontSize: 17, color: colors.ink },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  paymentLine: { ...type.small, marginTop: 4 },
  address: { backgroundColor: colors.paperDeep, borderRadius: radius.md, padding: 14, gap: 4 },
  addressLabel: { ...type.micro },
  addressText: { ...type.body },
  reason: { ...type.small, fontStyle: 'italic' },
});
