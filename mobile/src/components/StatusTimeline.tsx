import { StyleSheet, Text, View } from 'react-native';

import { formatTime } from '../format';
import type { OrderEvent } from '../api/types';
import { colors, type } from '../theme';

const FLOW: { status: string; label: string; hint: string }[] = [
  { status: 'placed', label: 'Order placed', hint: 'Payment approved' },
  { status: 'confirmed', label: 'Confirmed by store', hint: 'Picker assigned' },
  { status: 'packed', label: 'Packed', hint: 'Bagged and weighed' },
  { status: 'out_for_delivery', label: 'Out for delivery', hint: 'On the way to you' },
  { status: 'delivered', label: 'Delivered', hint: 'Enjoy' },
];

const ORDER = ['pending_payment', ...FLOW.map((f) => f.status)];

type Props = { status: string; events: OrderEvent[] };

/** Vertical timeline. Each stage is done, current, or upcoming, with the time it actually happened. */
export function StatusTimeline({ status, events }: Props) {
  if (status === 'cancelled' || status === 'expired' || status === 'pending_payment') {
    const terminal = events[events.length - 1];
    return (
      <View style={styles.terminal}>
        <Text style={styles.terminalTitle}>
          {status === 'pending_payment' ? 'Waiting for payment' : status === 'expired' ? 'Checkout expired' : 'Order cancelled'}
        </Text>
        <Text style={styles.terminalBody}>
          {status === 'pending_payment'
            ? 'Your items are held for a short time. Finish payment to place the order.'
            : terminal?.detail || 'Reserved stock has been released.'}
        </Text>
      </View>
    );
  }

  const currentIndex = ORDER.indexOf(status);

  return (
    <View>
      {FLOW.map((stage, index) => {
        const stageIndex = ORDER.indexOf(stage.status);
        const done = stageIndex < currentIndex || (stage.status === 'delivered' && status === 'delivered');
        const current = stage.status === status;
        const event = events.find((e) => e.status === stage.status);
        const last = index === FLOW.length - 1;
        const dotColor = done || current ? colors.leaf : colors.hairline;
        return (
          <View key={stage.status} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: done || current ? colors.leaf : colors.surface, borderColor: dotColor },
                  current && styles.dotCurrent,
                ]}
              />
              {!last ? <View style={[styles.line, { backgroundColor: done ? colors.leaf : colors.hairline }]} /> : null}
            </View>
            <View style={[styles.copy, !last && styles.copyGap]}>
              <Text style={[styles.label, !done && !current && styles.muted]}>{stage.label}</Text>
              <Text style={styles.hint}>
                {event ? `${formatTime(event.created_at)} · ${event.detail || stage.hint}` : stage.hint}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14 },
  rail: { width: 16, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginTop: 3 },
  dotCurrent: { width: 16, height: 16, borderRadius: 8, marginTop: 2, shadowColor: colors.leaf, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  line: { width: 2, flex: 1, marginVertical: 2, minHeight: 28 },
  copy: { flex: 1 },
  copyGap: { paddingBottom: 18 },
  label: { ...type.heading, fontSize: 15 },
  muted: { color: colors.inkMuted },
  hint: { ...type.small, fontSize: 13, marginTop: 2 },
  terminal: {
    backgroundColor: colors.paperDeep,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  terminalTitle: { ...type.heading, fontSize: 16 },
  terminalBody: { ...type.small },
});
