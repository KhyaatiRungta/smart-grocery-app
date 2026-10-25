import { useMemo, useRef, useState } from 'react';
import {KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import { router } from 'expo-router';

import { detailOf, usePayOrder, useCart, useCheckout } from '../api/hooks';
import { newIdempotencyKey } from '../api/client';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { formatINR } from '../format';
import { colors, radius, type } from '../theme';
import { showDialog } from '../dialog';

type Mode = 'delivery' | 'pickup';

export default function CheckoutScreen() {
  const cart = useCart();
  const checkout = useCheckout();
  const pay = usePayOrder();
  const [mode, setMode] = useState<Mode>('delivery');
  const [line, setLine] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [pincode, setPincode] = useState('');
  const [error, setError] = useState<string | null>(null);
  // One key per checkout screen: a double tap or a retry after a timeout reuses it, so the server never reserves twice.
  const idempotencyKey = useRef(newIdempotencyKey());

  const valid = useMemo(
    () => mode === 'pickup' || (line.trim().length >= 5 && city.trim().length > 0 && /^\d{6}$/.test(pincode.trim())),
    [mode, line, city, pincode],
  );

  const data = cart.data;
  const busy = checkout.isPending || pay.isPending;

  async function placeOrder() {
    setError(null);
    try {
      const order = await checkout.mutateAsync({
        delivery_mode: mode,
        address_line: mode === 'delivery' ? line.trim() : undefined,
        city: mode === 'delivery' ? city.trim() : undefined,
        pincode: mode === 'delivery' ? pincode.trim() : undefined,
        idempotencyKey: idempotencyKey.current,
      });
      await pay.mutateAsync(order.id);
      router.replace(`/order/${order.id}`);
    } catch (err) {
      const { message, available } = detailOf(err);
      setError(message);
      if (available !== undefined) {
        showDialog('Not enough stock', `${message}. Update your bag and try again.`, [
          { text: 'Back to bag', onPress: () => router.back() },
          { text: 'Stay here', style: 'cancel' },
        ]);
      }
    }
  }

  if (!data || data.items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Your bag is empty</Text>
        <Text style={styles.emptyBody}>Add something before checking out.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>How do you want it?</Text>
        <View style={styles.segment}>
          {(['delivery', 'pickup'] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setMode(m)}
                style={[styles.segmentItem, active && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {m === 'delivery' ? 'Deliver it' : 'Pick up at store'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'delivery' ? (
          <View style={styles.form}>
            <Text style={styles.section}>Where should we bring it?</Text>
            <Field label="Address" value={line} onChangeText={setLine} placeholder="Flat, street, landmark" />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Field label="City" value={city} onChangeText={setCity} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Pincode" value={pincode} onChangeText={setPincode} />
              </View>
            </View>
          </View>
        ) : (
          <Text style={styles.note}>Pick up from {'the store you chose'}. Bring your order number, we’ll have it bagged.</Text>
        )}

        <Text style={styles.section}>Your order</Text>
        <View style={styles.summary}>
          <Line label={`${data.item_count} ${data.item_count === 1 ? 'item' : 'items'}`} value={formatINR(data.subtotal_cents)} />
          <Line
            label={mode === 'pickup' ? 'Pickup' : 'Delivery'}
            value={mode === 'pickup' || data.delivery_fee_cents === 0 ? 'Free' : formatINR(data.delivery_fee_cents)}
          />
          <View style={styles.divider} />
          <Line label="To pay" value={formatINR(mode === 'pickup' ? data.subtotal_cents : data.total_cents)} strong />
        </View>

        <View style={styles.paymentNote}>
          <Text style={styles.paymentTitle}>Simulated payment</Text>
          <Text style={styles.paymentBody}>
            No card is charged. Approving the order here moves it to placed, and cancellations issue a labelled simulated refund.
          </Text>
        </View>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.bottom}>
        <Button
          label={busy ? 'Placing order…' : `Place order · ${formatINR(mode === 'pickup' ? data.subtotal_cents : data.total_cents)}`}
          onPress={placeOrder}
          loading={busy}
          disabled={!valid}
        />
      </View>
    </KeyboardAvoidingView>
  );
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8, backgroundColor: colors.paper },
  emptyTitle: { ...type.title },
  emptyBody: { ...type.small },
  content: { padding: 16, gap: 14, paddingBottom: 140 },
  section: { ...type.heading, fontSize: 18, marginTop: 6 },
  segment: { flexDirection: 'row', backgroundColor: colors.paperDeep, borderRadius: radius.md, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { ...type.small, fontWeight: '700' },
  segmentTextActive: { color: colors.ink },
  form: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  note: { ...type.small, backgroundColor: colors.leafSoft, padding: 14, borderRadius: radius.md },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 16,
    gap: 10,
  },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between' },
  lineLabel: { ...type.body, color: colors.inkSoft },
  lineValue: { ...type.body, fontVariant: ['tabular-nums'] },
  strong: { ...type.heading, fontSize: 17, color: colors.ink },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  paymentNote: { backgroundColor: colors.paperDeep, borderRadius: radius.md, padding: 14, gap: 4 },
  paymentTitle: { ...type.heading, fontSize: 14 },
  paymentBody: { ...type.small, fontSize: 12 },
  error: { ...type.small, color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.sm },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
});
