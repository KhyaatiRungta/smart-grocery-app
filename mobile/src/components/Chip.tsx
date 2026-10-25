import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, type } from '../theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  leading?: string;
  style?: StyleProp<ViewStyle>;
};

export function Chip({ label, selected, onPress, leading, style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed, style]}
    >
      <View style={styles.row}>
        {leading ? <Text style={styles.leading}>{leading}</Text> : null}
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.leaf, borderColor: colors.leaf },
  pressed: { opacity: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leading: { fontSize: 15 },
  label: { ...type.small, color: colors.ink, fontWeight: '600' },
  labelSelected: { color: colors.onPrimary },
});
