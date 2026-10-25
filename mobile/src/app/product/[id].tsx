import {ActivityIndicator, ScrollView, StyleSheet, Text, View} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { detailOf, useAddToCart, useCart, useProduct, useSetCartQuantity } from '../../api/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/Button';
import { QtyStepper } from '../../components/QtyStepper';
import { formatINR } from '../../format';
import { colors, radius, type } from '../../theme';
import { showDialog } from '../../dialog';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = Number(id);
  const { user } = useAuth();
  const storeId = user?.selected_store_id ?? null;
  const product = useProduct(productId, storeId);
  const cart = useCart();
  const addToCart = useAddToCart();
  const setQty = useSetCartQuantity();

  if (product.isLoading || !product.data) {
    return (
      <View style={styles.center}>
        {product.isError ? <Text style={styles.body}>{detailOf(product.error).message}</Text> : <ActivityIndicator color={colors.leaf} />}
      </View>
    );
  }

  const p = product.data;
  const inCart = cart.data?.items.find((l) => l.product.id === p.id)?.quantity ?? 0;
  const available = p.availability?.available ?? 0;
  const soldOut = !!p.availability && !p.availability.in_stock;
  const busy = addToCart.isPending || setQty.isPending;

  function fail(err: unknown) {
    showDialog('Can’t update your bag', detailOf(err).message);
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: p.bg_color }]}>
          <Text style={styles.heroEmoji}>{p.emoji}</Text>
        </View>

        <View style={styles.meta}>
          <Text style={styles.brand}>{p.brand}</Text>
          <Text style={styles.name}>{p.name}</Text>
          <Text style={styles.unit}>{p.unit} · {p.category.name}</Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatINR(p.price_cents)}</Text>
          <View style={[styles.stock, soldOut ? styles.stockOut : styles.stockIn]}>
            <Text style={[styles.stockText, soldOut ? styles.stockTextOut : styles.stockTextIn]}>
              {!storeId ? 'Choose a store to see stock' : soldOut ? 'Sold out at your store' : `${available} available nearby`}
            </Text>
          </View>
        </View>

        <Text style={styles.description}>{p.description}</Text>
      </ScrollView>

      <View style={styles.bottom}>
        {soldOut || !storeId ? (
          <Button label={soldOut ? 'Sold out here' : 'Choose a store first'} variant="ghost" disabled onPress={() => undefined} style={styles.flex} />
        ) : inCart > 0 ? (
          <>
            <QtyStepper
              value={inCart}
              max={Math.max(available, inCart)}
              disabled={busy}
              itemName={p.name}
              onChange={(next) => setQty.mutate({ productId: p.id, quantity: next }, { onError: fail })}
            />
            <Button label="Go to bag" variant="ghost" style={styles.flex} onPress={() => router.navigate('/cart')} />
          </>
        ) : (
          <Button
            label={`Add to bag · ${formatINR(p.price_cents)}`}
            loading={addToCart.isPending}
            style={styles.flex}
            onPress={() => addToCart.mutate({ productId: p.id }, { onError: fail })}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, padding: 24 },
  body: { ...type.body, textAlign: 'center' },
  content: { paddingBottom: 140 },
  hero: { height: 280, alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 140 },
  meta: { paddingHorizontal: 20, paddingTop: 20, gap: 4 },
  brand: { ...type.small, fontWeight: '600' },
  name: { ...type.display, fontSize: 28, lineHeight: 32 },
  unit: { ...type.small },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18 },
  price: { ...type.display, fontSize: 26 },
  stock: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  stockIn: { backgroundColor: colors.leafSoft },
  stockOut: { backgroundColor: colors.dangerSoft },
  stockText: { ...type.micro, fontWeight: '700' },
  stockTextIn: { color: colors.leaf },
  stockTextOut: { color: colors.danger },
  description: { ...type.body, color: colors.inkSoft, paddingHorizontal: 20, paddingTop: 16, lineHeight: 23 },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    alignItems: 'center',
  },
  flex: { flex: 1 },
});
