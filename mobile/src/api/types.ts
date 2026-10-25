export type Category = { id: number; name: string; slug: string; emoji: string; color: string; product_count?: number };

export type Availability = { store_id: number; available: number; in_stock: boolean };

export type Product = {
  id: number;
  sku: string;
  name: string;
  brand: string;
  description: string;
  unit: string;
  price_cents: number;
  emoji: string;
  bg_color: string;
  category: Category;
  availability: Availability | null;
};

export type ProductPage = { items: Product[]; total: number; page: number; page_size: number; has_more: boolean };

export type Store = {
  id: number;
  name: string;
  address: string;
  city: string;
  pincode: string;
  hours: string;
  delivery_eta_minutes: number;
};

export type User = { id: number; email: string; full_name: string; selected_store_id: number | null };

export type TokenResponse = { access_token: string; token_type: string; user: User };

export type CartLine = { product: Product; quantity: number; line_total_cents: number };

export type Cart = {
  store: Store | null;
  items: CartLine[];
  item_count: number;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  free_delivery_threshold_cents: number;
  delivery_fee_if_under_threshold_cents: number;
};

export type OrderEvent = { status: string; title: string; detail: string; created_at: string };

export type OrderItem = {
  product_id: number;
  product_name: string;
  unit: string;
  emoji: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
};

export type Order = {
  id: number;
  order_number: string;
  status: string;
  delivery_mode: 'delivery' | 'pickup';
  store_name: string;
  store_city: string;
  address_line: string;
  city: string;
  pincode: string;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  payment_status: string;
  refund_cents: number;
  reservation_expires_at: string | null;
  cancel_reason: string | null;
  cancellable: boolean;
  is_active: boolean;
  status_changed_at: string;
  created_at: string;
  item_count: number;
  items: OrderItem[];
  events: OrderEvent[];
};

export type CheckoutInput = {
  delivery_mode: 'delivery' | 'pickup';
  address_line?: string;
  city?: string;
  pincode?: string;
};

export type Notification = {
  id: number;
  order_id: number | null;
  title: string;
  body: string;
  read: boolean;
  push_status: string;
  created_at: string;
};

export type NotificationPage = { items: Notification[]; unread_count: number };

export type ApiErrorDetail = { message?: string; available?: number; product_id?: number };
