import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import type { ProductFilters } from '../api/hooks';
import { colors, type } from '../theme';
import { Button } from './Button';
import { Chip } from './Chip';

type Sort = NonNullable<ProductFilters['sort']>;

const SORTS: { value: Sort; label: string }[] = [
  { value: 'popularity', label: 'Most loved' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name', label: 'A to Z' },
];

const PRICE_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: 'Any price' },
  { label: 'Under ₹100', max: 9999 },
  { label: '₹100 to ₹500', min: 10000, max: 50000 },
  { label: 'Over ₹500', min: 50000 },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  value: { sort: Sort; inStock: boolean; band: number };
  canFilterStock: boolean;
  onApply: (next: { sort: Sort; inStock: boolean; band: number }) => void;
};

export function FilterSheet({ visible, onClose, value, canFilterStock, onApply }: Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close filters" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <Text style={styles.title}>Sort and filter</Text>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.section}>Sort by</Text>
          <View style={styles.wrap}>
            {SORTS.map((s) => (
              <Chip key={s.value} label={s.label} selected={draft.sort === s.value} onPress={() => setDraft({ ...draft, sort: s.value })} />
            ))}
          </View>

          <Text style={styles.section}>Price</Text>
          <View style={styles.wrap}>
            {PRICE_BANDS.map((b, i) => (
              <Chip key={b.label} label={b.label} selected={draft.band === i} onPress={() => setDraft({ ...draft, band: i })} />
            ))}
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.section}>In stock at this store</Text>
              <Text style={styles.note}>
                {canFilterStock ? 'Hide items that are sold out here.' : 'Pick a store first to filter by stock.'}
              </Text>
            </View>
            <Switch
              accessibilityLabel="Only show items in stock"
              value={draft.inStock && canFilterStock}
              disabled={!canFilterStock}
              onValueChange={(inStock) => setDraft({ ...draft, inStock })}
              trackColor={{ true: colors.leaf, false: colors.hairline }}
            />
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Button
            label="Reset"
            variant="ghost"
            style={styles.half}
            onPress={() => setDraft({ sort: 'popularity', inStock: false, band: 0 })}
          />
          <Button label="Show items" style={styles.half} onPress={() => onApply(draft)} />
        </View>
      </View>
    </Modal>
  );
}

export { PRICE_BANDS, SORTS };

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(27,42,36,0.35)' },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 28,
    maxHeight: '78%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.hairline, marginTop: 10 },
  title: { ...type.title, paddingHorizontal: 20, paddingTop: 14 },
  body: { padding: 20, gap: 12 },
  section: { ...type.heading, marginTop: 6 },
  note: { ...type.small },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 8 },
  half: { flex: 1 },
});
