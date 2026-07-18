import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { getSettings } from "./settings";
import { haversineKm, isOpenNow, normalizePhone, todayHours } from "./utils";
import type { CartOption, OrderAddress, PaymentMethod } from "./types";

export type OrderPayload = {
  type: "delivery" | "pickup";
  items: Array<{
    productId: string;
    qty: number;
    options: Array<{ group: string; item: string }>;
    notes?: string;
  }>;
  customer: { name: string; phone: string; email?: string };
  address?: { street: string; details?: string; city?: string; lat?: number; lng?: number };
  payment_method: PaymentMethod;
  requested_time: string; // 'asap' | 'HH:MM'
  notes?: string;
  delivery_notes?: string;
  promo_code?: string;
  auth_user_id?: string | null;
};

export class OrderError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400
  ) {
    super(message);
  }
}

const DELIVERY_METHODS: PaymentMethod[] = ["card_online", "cash_delivery", "card_delivery"];
const PICKUP_METHODS: PaymentMethod[] = ["card_online", "cash_pickup", "card_pickup"];

export async function createOrder(payload: OrderPayload) {
  const db = supabaseAdmin();
  const settings = await getSettings();

  /* ── validări de bază ── */
  if (!payload.items?.length) throw new OrderError("Coșul este gol.", "empty_cart");
  if (payload.items.length > 60 || payload.items.some((i) => i.qty < 1 || i.qty > 50)) {
    throw new OrderError("Comanda conține cantități invalide.", "invalid_qty");
  }
  const name = payload.customer?.name?.trim();
  if (!name || name.length < 2) throw new OrderError("Numele este obligatoriu.", "invalid_name");
  const phone = normalizePhone(payload.customer?.phone ?? "");
  if (!phone) throw new OrderError("Numărul de telefon nu pare valid.", "invalid_phone");
  const email = payload.customer.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new OrderError("Adresa de email nu pare validă.", "invalid_email");
  }

  if (!settings.ordering.enabled) {
    throw new OrderError(
      settings.ordering.pause_message || "Comenzile online sunt momentan oprite.",
      "ordering_paused"
    );
  }
  if (payload.type === "delivery" && !settings.ordering.delivery_enabled) {
    throw new OrderError("Livrarea nu este disponibilă momentan.", "delivery_disabled");
  }
  if (payload.type === "pickup" && !settings.ordering.pickup_enabled) {
    throw new OrderError("Ridicarea personală nu este disponibilă momentan.", "pickup_disabled");
  }

  const allowedMethods = payload.type === "delivery" ? DELIVERY_METHODS : PICKUP_METHODS;
  if (!allowedMethods.includes(payload.payment_method)) {
    throw new OrderError("Metoda de plată nu este validă pentru acest tip de comandă.", "invalid_payment");
  }

  /* ── program ── */
  const now = new Date();
  const requested = payload.requested_time?.trim() || "asap";
  if (requested === "asap") {
    if (!isOpenNow(settings.hours, now)) {
      throw new OrderError(
        "Suntem închiși acum. Programează comanda în intervalul orar de funcționare.",
        "closed"
      );
    }
  } else {
    if (!/^\d{2}:\d{2}$/.test(requested)) {
      throw new OrderError("Ora programată nu este validă.", "invalid_time");
    }
    const today = todayHours(settings.hours, now);
    if (!today) throw new OrderError("Astăzi este închis.", "closed_today");
    const [rh, rm] = requested.split(":").map(Number);
    const reqMin = rh * 60 + rm;
    const [oh, om] = today.open.split(":").map(Number);
    const [ch, cm] = today.close.split(":").map(Number);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (reqMin < Math.max(oh * 60 + om, nowMin + 25) || reqMin > ch * 60 + cm) {
      throw new OrderError(
        `Alege o oră între program (${today.open}–${today.close}), cu minimum 25 de minute în avans.`,
        "invalid_time"
      );
    }
  }

  /* ── produse + prețuri din DB (nu ne încredem în client) ── */
  const ids = [...new Set(payload.items.map((i) => i.productId))];
  const { data: prods, error: prodErr } = await db
    .from("products")
    .select(
      "id,name,price,promo_price,available,archived,option_groups:product_option_groups(id,name,required,multi,min_select,max_select,items:product_option_items(id,name,price_delta,available))"
    )
    .in("id", ids);
  if (prodErr) throw new OrderError("Eroare la validarea produselor.", "db", 500);
  const productMap = new Map((prods ?? []).map((p) => [p.id, p]));

  type LineInsert = {
    product_id: string;
    name: string;
    qty: number;
    unit_price: number;
    options: CartOption[];
    total: number;
    notes: string | null;
  };
  const lines: LineInsert[] = [];

  for (const item of payload.items) {
    const p = productMap.get(item.productId);
    if (!p || p.archived) throw new OrderError("Un produs din coș nu mai există.", "product_missing");
    if (!p.available) {
      throw new OrderError(`„${p.name}” nu mai este disponibil azi.`, "product_unavailable");
    }
    const base = Number(p.promo_price ?? p.price);
    const resolved: CartOption[] = [];

    for (const opt of item.options ?? []) {
      const group = (p.option_groups ?? []).find((g) => g.name === opt.group);
      const optItem = group?.items?.find((i) => i.name === opt.item && i.available);
      if (!group || !optItem) {
        throw new OrderError(
          `Opțiunea „${opt.item}” pentru „${p.name}” nu mai este disponibilă.`,
          "option_missing"
        );
      }
      resolved.push({ group: group.name, item: optItem.name, delta: Number(optItem.price_delta) });
    }

    for (const g of p.option_groups ?? []) {
      const count = resolved.filter((o) => o.group === g.name).length;
      if (g.required && count < Math.max(1, g.min_select)) {
        throw new OrderError(`Alege „${g.name}” pentru „${p.name}”.`, "option_required");
      }
      if (count > g.max_select && g.multi) {
        throw new OrderError(`Prea multe opțiuni la „${g.name}”.`, "option_overflow");
      }
    }

    const unit = Math.round((base + resolved.reduce((s, o) => s + o.delta, 0)) * 100) / 100;
    lines.push({
      product_id: p.id,
      name: p.name,
      qty: item.qty,
      unit_price: unit,
      options: resolved,
      total: Math.round(unit * item.qty * 100) / 100,
      notes: item.notes?.trim() || null,
    });
  }

  const subtotal = Math.round(lines.reduce((s, l) => s + l.total, 0) * 100) / 100;

  /* ── livrare + zonă ── */
  let address: OrderAddress | null = null;
  let deliveryFee = 0;
  if (payload.type === "delivery") {
    const a = payload.address;
    if (!a?.street || a.street.trim().length < 5) {
      throw new OrderError("Adresa de livrare este obligatorie.", "invalid_address");
    }
    if (typeof a.lat !== "number" || typeof a.lng !== "number") {
      throw new OrderError(
        "Nu am putut localiza adresa. Verific-o sau sună-ne pentru comandă telefonică.",
        "address_not_located"
      );
    }
    const dist =
      Math.round(
        haversineKm(settings.restaurant.lat, settings.restaurant.lng, a.lat, a.lng) * 100
      ) / 100;
    if (dist > settings.delivery.radius_km) {
      throw new OrderError(
        `Adresa este în afara zonei de livrare (${settings.delivery.radius_km} km). Poți comanda prin Glovo sau să ridici personal.`,
        "out_of_zone"
      );
    }
    if (subtotal < settings.delivery.min_order) {
      throw new OrderError(
        `Comanda minimă pentru livrare este ${settings.delivery.min_order} lei.`,
        "below_min_order"
      );
    }
    deliveryFee =
      settings.delivery.free_over != null && subtotal >= settings.delivery.free_over
        ? 0
        : settings.delivery.fee;
    address = {
      street: a.street.trim(),
      details: a.details?.trim() || undefined,
      city: a.city?.trim() || "București",
      lat: a.lat,
      lng: a.lng,
      distance_km: dist,
    };
  }

  /* ── promo ── */
  let discount = 0;
  let promoCode: string | null = null;
  let promoId: string | null = null;
  if (payload.promo_code?.trim()) {
    const code = payload.promo_code.trim();
    const { data: promo } = await db
      .from("promo_codes")
      .select("*")
      .ilike("code", code)
      .eq("active", true)
      .maybeSingle();
    const nowIso = now.toISOString();
    const valid =
      promo &&
      (!promo.starts_at || promo.starts_at <= nowIso) &&
      (!promo.ends_at || promo.ends_at >= nowIso) &&
      (promo.max_uses == null || promo.used_count < promo.max_uses) &&
      subtotal >= Number(promo.min_order);
    if (!valid) {
      throw new OrderError("Codul promoțional nu este valid pentru această comandă.", "invalid_promo");
    }
    discount =
      promo.type === "percent"
        ? Math.round(subtotal * Number(promo.value)) / 100
        : Math.min(Number(promo.value), subtotal);
    discount = Math.round(discount * 100) / 100;
    promoCode = promo.code;
    promoId = promo.id;
  }

  const total = Math.max(0, Math.round((subtotal + deliveryFee - discount) * 100) / 100);

  /* ── client (dedupe după telefon) ── */
  const { data: existingCustomer } = await db
    .from("customers")
    .select("id,auth_user_id,email,name")
    .eq("phone", phone)
    .maybeSingle();

  let customerId: string;
  if (existingCustomer) {
    customerId = existingCustomer.id;
    const patch: Record<string, unknown> = { name };
    if (email) patch.email = email;
    if (payload.auth_user_id && !existingCustomer.auth_user_id) {
      patch.auth_user_id = payload.auth_user_id;
    }
    await db.from("customers").update(patch).eq("id", customerId);
  } else {
    const { data: created, error: custErr } = await db
      .from("customers")
      .insert({ phone, name, email, auth_user_id: payload.auth_user_id ?? null })
      .select("id")
      .single();
    if (custErr || !created) throw new OrderError("Eroare la salvarea clientului.", "db", 500);
    customerId = created.id;
  }

  /* ── inserare comandă ── */
  const { data: order, error: orderErr } = await db
    .from("orders")
    .insert({
      customer_id: customerId,
      type: payload.type,
      payment_method: payload.payment_method,
      payment_status: "pending",
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      address,
      delivery_notes: payload.delivery_notes?.trim() || null,
      notes: payload.notes?.trim() || null,
      requested_time: requested,
      subtotal,
      delivery_fee: deliveryFee,
      discount,
      total,
      promo_code: promoCode,
    })
    .select("*")
    .single();
  if (orderErr || !order) throw new OrderError("Eroare la crearea comenzii.", "db", 500);

  const { error: itemsErr } = await db
    .from("order_items")
    .insert(lines.map((l) => ({ ...l, order_id: order.id })));
  if (itemsErr) {
    await db.from("orders").delete().eq("id", order.id);
    throw new OrderError("Eroare la salvarea produselor comenzii.", "db", 500);
  }

  await db.from("order_events").insert({
    order_id: order.id,
    event_type: "created",
    to_status: "new",
    note: `Comandă plasată online (${payload.type === "delivery" ? "livrare" : "ridicare"})`,
  });

  if (promoId) {
    await db.rpc("increment_promo_use", { promo_id: promoId });
  }

  // salvăm adresa în profilul clientului autentificat (dacă e nouă)
  if (payload.auth_user_id && address) {
    const { data: existing } = await db
      .from("customer_addresses")
      .select("id")
      .eq("customer_id", customerId)
      .ilike("street", address.street)
      .maybeSingle();
    if (!existing) {
      await db.from("customer_addresses").insert({
        customer_id: customerId,
        street: address.street,
        details: address.details ?? null,
        city: address.city,
        lat: address.lat,
        lng: address.lng,
      });
    }
  }

  return order;
}
