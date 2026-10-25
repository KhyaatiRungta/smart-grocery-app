import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { detailOf, useSelectStore, useStores } from '../api/hooks';
import { useAuth } from '../auth/AuthProvider';
import { colors, radius, type } from '../theme';
import { showDialog } from '../dialog';

export default function StoresScreen() {
  const { user, setUser } = useAuth();
  const stores = useStores();
  const select = useSelectStore();

  function choose(storeId: number) {
    select.mutate(storeId, {
      onSuccess: (updated) => {
        setUser(updated);
        router.back();
      },
      onError: (err) => showDialog('Can’t switch store', detailOf(err).message),
    });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.lede}>Stock and prices are set per store. Your bag is saved for each one.</Text>
      {stores.isLoading ? <ActivityIndicator color={colors.leaf} /> : null}
      {stores.data?.map((store) => {
        const selected = store.id === user?.selected_store_id;
        return (
          <Pressable
            key={store.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${store.name}. ${selected ? 'Selected' : 'Choose this store'}`}
            disabled={select.isPending}
            onPress={() => choose(store.id)}
            style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="storefront-outline" size={22} color={selected ? colors.onPrimary : colors.leaf} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.name, selected && styles.onDark]}>{store.name.replace('Smart Grocer · ', '')}</Text>
              <Text style={[styles.meta, selected && styles.onDarkSoft]}>{store.address}, {store.city} {store.pincode}</Text>
              <Text style={[styles.meta, selected && styles.onDarkSoft]}>
                {store.hours} · about {store.delivery_eta_minutes} min
              </Text>
            </View>
            {selected ? <Ionicons name="checkmark-circle" size={24} color={colors.onPrimary} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  lede: { ...type.small, marginBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  cardSelected: { backgroundColor: colors.leaf, borderColor: colors.leaf },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.leafSoft, alignItems: 'center', justifyContent: 'center' },
  name: { ...type.heading },
  meta: { ...type.small, fontSize: 12 },
  onDark: { color: colors.onPrimary },
  onDarkSoft: { color: '#CFE3D6' },
});
