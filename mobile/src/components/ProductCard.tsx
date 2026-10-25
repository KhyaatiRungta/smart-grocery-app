import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatINR } from '../format';
import type { Product } from '../api/types';
import { colors, radius, shadow, type } from '../theme';
import { QtyStepper } from './QtyStepper';

type Props = {
  product: Product;
  inCart: number;
  canShop: boolean;
  onOpen: () => void;
  onAdd: () => void;
  onChangeQty: (qty: number) => void;
  busy?: boolean;
};

export function ProductCard({ product, inCart, canShop, onOpen, onAdd, onChangeQty, busy }: Props) {
  const outOfStock = !!product.availability && !product.availability.in_stock;
  const maxQty = product.availability?.available ?? 99;
  const lowStock = !!product.availability && product.availability.in_stock && product.availability.available <= 3;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, ${formatINR(product.price_cents)}`}
        onPress={onOpen}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <View style={[styles.tile, { backgroundColor: product.bg_color }]}>
          <Text style={styles.emoji}>{product.emoji}</Text>
          {outOfStock ? (
            <View style={styles.oos}>
              <Text style={styles.oosText}>Sold out here</Text>
            </View>
          ) : lowStock ? (
            <View style={styles.low}>
              <Text style={styles.lowText}>Only {product.availability?.available} left</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <Text style={styles.brand} numberOfLines={1}>
            {product.brand}
          </Text>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>
          <Text style={styles.unit}>{product.unit}</Text>
        </View>
      </Pressable>
      <View style={styles.footer}>
        <Text style={styles.price}>{formatINR(product.price_cents)}</Text>
        {outOfStock || !canShop ? null : inCart > 0 ? (
          <QtyStepper
            size="sm"
            value={inCart}
            max={maxQty}
            disabled={busy}
            itemName={product.name}
            onChange={onChangeQty}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${product.name} to cart`}
            onPress={onAdd}
            disabled={busy}
            style={({ pressed }) => [styles.add, pressed && styles.pressed, busy && styles.off]}
          >
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    overflow: 'hidden',
    ...shadow,
  },
  pressed: { opacity: 0.9 },
  off: { opacity: 0.5 },
  tile: {
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 58 },
  oos: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    backgroundColor: colors.ink,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  oosText: { ...type.micro, color: colors.surface, fontWeight: '700' },
  low: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lowText: { ...type.micro, color: colors.warning, fontWeight: '700' },
  body: { paddingHorizontal: 12, paddingTop: 10, gap: 2 },
  brand: { ...type.micro },
  name: { ...type.heading, fontSize: 15, lineHeight: 19, minHeight: 38 },
  unit: { ...type.small, fontSize: 12 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
  },
  price: { ...type.price },
  add: {
    backgroundColor: colors.leafSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  addText: { color: colors.leaf, fontWeight: '800', fontSize: 14 },
});
