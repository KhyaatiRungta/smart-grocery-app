import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, type } from '../theme';

type Props = {
  value: number;
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  itemName?: string;
};

export function QtyStepper({ value, max, onChange, disabled, size = 'md', itemName = 'item' }: Props) {
  const compact = size === 'sm';
  const canInc = !disabled && value < max;
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} accessibilityLabel={`Quantity of ${itemName}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${itemName}`}
        onPress={() => onChange(value - 1)}
        disabled={disabled}
        style={({ pressed }) => [styles.btn, compact && styles.btnCompact, pressed && styles.pressed]}
        hitSlop={6}
      >
        <Ionicons name={value <= 1 ? 'trash-outline' : 'remove'} size={compact ? 14 : 16} color={colors.leaf} />
      </Pressable>
      <Text style={[styles.value, compact && styles.valueCompact]}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${itemName}`}
        onPress={() => onChange(value + 1)}
        disabled={!canInc}
        style={({ pressed }) => [styles.btn, compact && styles.btnCompact, !canInc && styles.off, pressed && styles.pressed]}
        hitSlop={6}
      >
        <Ionicons name="add" size={compact ? 14 : 16} color={canInc ? colors.leaf : colors.inkMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.leafSoft,
    borderRadius: radius.pill,
    padding: 4,
    gap: 6,
  },
  wrapCompact: { padding: 2, gap: 4 },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCompact: { width: 26, height: 26, borderRadius: 13 },
  pressed: { opacity: 0.7 },
  off: { opacity: 0.5 },
  value: { ...type.price, minWidth: 22, textAlign: 'center' },
  valueCompact: { fontSize: 14, minWidth: 18 },
});
