import { useEffect, useMemo, useState } from 'react';
import {ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { detailOf, useAddToCart, useCart, useCategories, useProducts, useSetCartQuantity, useStores } from '../../api/hooks';
import type { Product } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { Chip } from '../../components/Chip';
import { FilterSheet, PRICE_BANDS } from '../../components/FilterSheet';
import { ProductCard } from '../../components/ProductCard';
import { colors, radius, type } from '../../theme';
import { showDialog } from '../../dialog';

type Sort = 'popularity' | 'price_asc' | 'price_desc' | 'name';

export default function ShopScreen() {
  const { user } = useAuth();
  const storeId = user?.selected_store_id ?? null;
  const firstName = user?.full_name.split(' ')[0] ?? '';

  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [filter, setFilter] = useState<{ sort: Sort; inStock: boolean; band: number }>({ sort: 'popularity', inStock: false, band: 0 });
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchText.trim()), 280);
    return () => clearTimeout(timer);
  }, [searchText]);

  const band = PRICE_BANDS[filter.band];
  const products = useProducts({
    q: query || undefined,
    category,
    minPrice: band.min,
    maxPrice: band.max,
    inStock: filter.inStock,
    sort: filter.sort,
    storeId,
  });
  const categories = useCategories();
  const stores = useStores();
  const cart = useCart();
  const addToCart = useAddToCart();
  const setQty = useSetCartQuantity();

  const store = stores.data?.find((s) => s.id === storeId);
  const qtyByProduct = useMemo(() => {
    const map = new Map<number, number>();
    for (const line of cart.data?.items ?? []) map.set(line.product.id, line.quantity);
    return map;
  }, [cart.data]);

  const items: Product[] = products.data?.pages.flatMap((p) => p.items) ?? [];
  const total = products.data?.pages[0]?.total ?? 0;
  const filtersActive = filter.sort !== 'popularity' || filter.inStock || filter.band !== 0;

  function handleAdd(product: Product) {
    addToCart.mutate(
      { productId: product.id },
      { onError: (err) => showDialog('Can’t add that', detailOf(err).message) },
    );
  }

  function handleQty(product: Product, next: number) {
    setQty.mutate(
      { productId: product.id, quantity: next },
      { onError: (err) => showDialog('Can’t change quantity', detailOf(err).message) },
    );
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.hello}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{firstName ? `Hi, ${firstName}` : 'Hi there'}</Text>
          <Text style={styles.headline}>What’s on the list?</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Shopping at ${store?.name ?? 'no store'}. Change store`}
        onPress={() => router.push('/stores')}
        style={({ pressed }) => [styles.storeRow, pressed && styles.pressed]}
      >
        <Ionicons name="location-outline" size={18} color={colors.leaf} />
        <View style={{ flex: 1 }}>
          <Text style={styles.storeName} numberOfLines={1}>
            {store ? store.name.replace('Smart Grocer · ', '') : 'Choose a store'}
          </Text>
          <Text style={styles.storeMeta} numberOfLines={1}>
            {store ? `${store.city} · about ${store.delivery_eta_minutes} min` : 'Pick where you’d like to shop'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={colors.inkMuted} />
      </Pressable>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.inkMuted} />
          <TextInput
            accessibilityLabel="Search products"
            placeholder="Search mangoes, milk, dal…"
            placeholderTextColor={colors.inkMuted}
            value={searchText}
            onChangeText={setSearchText}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchText ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearchText('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.inkMuted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sort and filter"
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [styles.filterBtn, filtersActive && styles.filterBtnActive, pressed && styles.pressed]}
        >
          <Ionicons name="options-outline" size={20} color={filtersActive ? colors.onPrimary : colors.ink} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
        <Chip label="All" selected={!category} onPress={() => setCategory(undefined)} />
        {categories.data?.map((c) => (
          <Chip
            key={c.slug}
            label={c.name}
            leading={c.emoji}
            selected={category === c.slug}
            onPress={() => setCategory(category === c.slug ? undefined : c.slug)}
          />
        ))}
      </ScrollView>

      <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>
          {products.isFetching && !products.isFetchingNextPage ? 'Updating…' : `${total} ${total === 1 ? 'item' : 'items'}`}
          {query ? ` for “${query}”` : ''}
        </Text>
        {filtersActive ? (
          <Pressable accessibilityRole="button" onPress={() => setFilter({ sort: 'popularity', inStock: false, band: 0 })}>
            <Text style={styles.clear}>Clear filters</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columns}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (products.hasNextPage && !products.isFetchingNextPage) products.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            inCart={qtyByProduct.get(item.id) ?? 0}
            canShop={!!storeId}
            busy={addToCart.isPending || setQty.isPending}
            onOpen={() => router.push(`/product/${item.id}`)}
            onAdd={() => handleAdd(item)}
            onChangeQty={(qty) => handleQty(item, qty)}
          />
        )}
        ListEmptyComponent={
          products.isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.leaf} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing matches that</Text>
              <Text style={styles.emptyBody}>Try a shorter search, another category, or clear your filters.</Text>
            </View>
          )
        }
        ListFooterComponent={products.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.leaf} /> : undefined}
      />

      <FilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        value={filter}
        canFilterStock={!!storeId}
        onApply={(next) => {
          setFilter(next);
          setSheetOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  listContent: { paddingHorizontal: 10, paddingBottom: 32 },
  columns: { paddingHorizontal: 6 },
  header: { paddingHorizontal: 10, paddingTop: 56, gap: 14, paddingBottom: 6 },
  hello: { flexDirection: 'row', alignItems: 'flex-end' },
  greeting: { ...type.small, fontWeight: '600' },
  headline: { ...type.display, fontSize: 30, lineHeight: 34, marginTop: 2 },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 6,
  },
  storeName: { ...type.heading, fontSize: 15 },
  storeMeta: { ...type.small, fontSize: 12 },
  pressed: { opacity: 0.85 },
  searchRow: { flexDirection: 'row', gap: 10, marginHorizontal: 6, alignItems: 'center' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.ink, height: '100%' },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: colors.leaf, borderColor: colors.leaf },
  catRow: { gap: 8, paddingHorizontal: 6, paddingVertical: 2 },
  resultsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 6 },
  resultsText: { ...type.small },
  clear: { ...type.small, color: colors.tomato, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 6, paddingHorizontal: 24 },
  emptyTitle: { ...type.title, fontSize: 20 },
  emptyBody: { ...type.small, textAlign: 'center' },
  footer: { paddingVertical: 20 },
});
