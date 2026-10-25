import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { api, ApiError, newIdempotencyKey } from './client';
import type {
  Cart,
  Category,
  CheckoutInput,
  NotificationPage,
  Order,
  Product,
  ProductPage,
  Store,
  User,
} from './types';

export type ProductFilters = {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: 'popularity' | 'price_asc' | 'price_desc' | 'name';
  storeId?: number | null;
};

export const keys = {
  categories: ['categories'] as const,
  stores: ['stores'] as const,
  products: (f: ProductFilters) => ['products', f] as const,
  product: (id: number, storeId: number | null | undefined) => ['product', id, storeId ?? null] as const,
  cart: ['cart'] as const,
  orders: (scope: string) => ['orders', scope] as const,
  order: (id: number) => ['order', id] as const,
  notifications: ['notifications'] as const,
};

export function useCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: () => api<Category[]>('/api/categories', { auth: false }) });
}

export function useStores() {
  return useQuery({ queryKey: keys.stores, queryFn: () => api<Store[]>('/api/stores', { auth: false }) });
}

export function useProducts(filters: ProductFilters) {
  return useInfiniteQuery({
    queryKey: keys.products(filters),
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set('page', String(pageParam));
      params.set('page_size', '20');
      params.set('sort', filters.sort ?? 'popularity');
      if (filters.q) params.set('q', filters.q);
      if (filters.category) params.set('category', filters.category);
      if (filters.minPrice !== undefined) params.set('min_price_cents', String(filters.minPrice));
      if (filters.maxPrice !== undefined) params.set('max_price_cents', String(filters.maxPrice));
      if (filters.storeId) params.set('store_id', String(filters.storeId));
      if (filters.inStock && filters.storeId) params.set('in_stock', 'true');
      return api<ProductPage>(`/api/products?${params.toString()}`, { auth: false });
    },
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
  });
}

export function useProduct(id: number, storeId: number | null | undefined) {
  const params = storeId ? `?store_id=${storeId}` : '';
  return useQuery({
    queryKey: keys.product(id, storeId),
    queryFn: () => api<Product>(`/api/products/${id}${params}`, { auth: false }),
  });
}

export function useCart(enabled = true) {
  return useQuery({ queryKey: keys.cart, queryFn: () => api<Cart>('/api/cart'), enabled });
}

function useInvalidateCart() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: keys.cart });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['product'] });
  };
}

export function useAddToCart() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCart();
  return useMutation({
    mutationFn: (vars: { productId: number; quantity?: number }) =>
      api<Cart>('/api/cart/items', { method: 'POST', body: { product_id: vars.productId, quantity: vars.quantity ?? 1 } }),
    onSuccess: (cart) => {
      queryClient.setQueryData(keys.cart, cart);
      invalidate();
    },
  });
}

export function useSetCartQuantity() {
  const invalidate = useInvalidateCart();
  return useMutation({
    mutationFn: (vars: { productId: number; quantity: number }) =>
      api<Cart>(`/api/cart/items/${vars.productId}`, { method: 'PUT', body: { quantity: vars.quantity } }),
    onSuccess: invalidate,
  });
}

export function useRemoveFromCart() {
  const invalidate = useInvalidateCart();
  return useMutation({
    mutationFn: (productId: number) => api<Cart>(`/api/cart/items/${productId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useSelectStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (storeId: number) => api<User>('/api/me/store', { method: 'PUT', body: { store_id: storeId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.cart });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
    },
  });
}

/** Creates a pending_payment order. The key is generated once per attempt so retries are safe. */
export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CheckoutInput & { idempotencyKey?: string }) => {
      const { idempotencyKey, ...body } = input;
      return api<Order>('/api/checkout', {
        method: 'POST',
        body,
        idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.cart });
    },
  });
}

export function usePayOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: number) => api<Order>(`/api/orders/${orderId}/pay`, { method: 'POST' }),
    onSuccess: (order) => {
      queryClient.setQueryData(keys.order(order.id), order);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: keys.notifications });
    },
  });
}

export function useOrders(scope: 'active' | 'past' | 'all') {
  return useQuery({
    queryKey: keys.orders(scope),
    queryFn: () => api<Order[]>(`/api/orders?scope=${scope}`),
    refetchInterval: scope === 'past' ? false : 8000,
  });
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: keys.order(id),
    queryFn: () => api<Order>(`/api/orders/${id}`),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ['delivered', 'cancelled', 'expired'].includes(status) ? false : 5000;
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { orderId: number; reason: string }) =>
      api<Order>(`/api/orders/${vars.orderId}/cancel`, { method: 'POST', body: { reason: vars.reason } }),
    onSuccess: (order) => {
      queryClient.setQueryData(keys.order(order.id), order);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: keys.notifications });
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: () => api<NotificationPage>('/api/notifications'),
    refetchInterval: 15000,
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/api/notifications/read-all', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.notifications }),
  });
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function detailOf(error: unknown): { message: string; available?: number } {
  if (error instanceof ApiError) {
    const detail = error.detail as { message?: string; available?: number } | string | null;
    if (typeof detail === 'string') return { message: detail };
    if (detail && typeof detail === 'object') return { message: detail.message ?? error.message, available: detail.available };
    return { message: error.message };
  }
  return { message: 'Something went wrong. Try again.' };
}
