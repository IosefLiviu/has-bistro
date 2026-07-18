export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort: number;
  active: boolean;
};

export type OptionItem = {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  default_selected: boolean;
  available: boolean;
  sort: number;
};

export type OptionGroup = {
  id: string;
  product_id: string;
  name: string;
  required: boolean;
  multi: boolean;
  min_select: number;
  max_select: number;
  sort: number;
  items: OptionItem[];
};

export type Product = {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  allergens: string[];
  weight_label: string | null;
  price: number;
  promo_price: number | null;
  promo_label: string | null;
  image_url: string | null;
  available: boolean;
  featured: boolean;
  is_new: boolean;
  sort: number;
  archived: boolean;
  option_groups?: OptionGroup[];
};

export type DailyMenu = {
  id: string;
  menu_date: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  published: boolean;
  available: boolean;
};

export type OrderStatus =
  | "new"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "refunded";

export type PaymentMethod =
  | "card_online"
  | "cash_delivery"
  | "card_delivery"
  | "cash_pickup"
  | "card_pickup";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type OrderAddress = {
  street: string;
  details?: string;
  city: string;
  lat?: number;
  lng?: number;
  distance_km?: number;
};

export type CartOption = { group: string; item: string; delta: number };

export type CartLine = {
  key: string; // productId + options hash
  productId: string;
  slug: string;
  name: string;
  unitPrice: number;
  qty: number;
  options: CartOption[];
  notes?: string;
  imageUrl?: string | null;
  categorySlug?: string;
};

export type Order = {
  id: string;
  order_number: number;
  customer_id: string | null;
  type: "delivery" | "pickup";
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  address: OrderAddress | null;
  delivery_notes: string | null;
  notes: string | null;
  requested_time: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  promo_code: string | null;
  stripe_payment_intent: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  completed_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  events?: OrderEvent[];
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  qty: number;
  unit_price: number;
  options: CartOption[];
  total: number;
  notes: string | null;
};

export type OrderEvent = {
  id: string;
  order_id: string;
  staff_id: string | null;
  staff_name: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
};

export type Staff = {
  id: string;
  name: string;
  role: "admin" | "manager" | "staff";
  active: boolean;
};

export type Customer = {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  auth_user_id: string | null;
  notes: string | null;
  created_at: string;
};

export type CustomerStats = Customer & {
  orders_count: number;
  total_spent: number;
  last_order_at: string | null;
};

export type PromoCode = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  used_count: number;
};

export type RestaurantSettings = {
  name: string;
  tagline: string;
  phones: string[];
  email: string;
  address_label: string;
  lat: number;
  lng: number;
  events_note?: string;
};

export type DeliverySettings = {
  radius_km: number;
  fee: number;
  free_over: number | null;
  min_order: number;
};

export type DayHours = { open: string; close: string } | null;
export type HoursSettings = {
  mon: DayHours; tue: DayHours; wed: DayHours; thu: DayHours;
  fri: DayHours; sat: DayHours; sun: DayHours;
  closed_dates: string[];
};

export type OrderingSettings = {
  enabled: boolean;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  prep_minutes: number;
  delivery_minutes: number;
  pause_message: string;
};

export type NotificationSettings = {
  sound: string;
  volume: number;
  repeat_seconds: number;
  escalate_after_minutes: number;
  escalation_webhook_url: string;
  browser_notifications: boolean;
  quiet_hours: { start: string; end: string } | null;
};

export type PrinterSettings = {
  auto_print_on_accept: boolean;
  width_mm: number;
  header_note: string;
  footer_note: string;
};

export type GlovoSettings = { url: string; label: string };

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "new",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Comandă nouă",
  accepted: "Acceptată",
  preparing: "În preparare",
  ready: "Gata de ridicare",
  out_for_delivery: "În livrare",
  completed: "Finalizată",
  cancelled: "Anulată",
  refunded: "Rambursată",
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  card_online: "Card online",
  cash_delivery: "Numerar la livrare",
  card_delivery: "Card la livrare",
  cash_pickup: "Numerar la ridicare",
  card_pickup: "Card la ridicare",
};
