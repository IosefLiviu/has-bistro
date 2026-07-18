import type { CartOption, HoursSettings, OrderStatus } from "./types";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function lei(value: number | string) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  const rounded = Math.round(n * 100) / 100;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(".", ",");
  return `${text} lei`;
}

/** Normalizează un număr de telefon românesc la formatul 07XXXXXXXX. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  let d = digits;
  if (d.startsWith("+4")) d = d.slice(2);
  else if (d.startsWith("004")) d = d.slice(3);
  else if (d.startsWith("4") && d.length === 11) d = d.slice(1);
  if (/^07\d{8}$/.test(d)) return d;
  if (/^7\d{8}$/.test(d)) return `0${d}`;
  // fixe (021...) sau alte formate valide de 10 cifre cu 0 în față
  if (/^0\d{9}$/.test(d)) return d;
  return null;
}

export function formatPhone(phone: string) {
  if (/^0\d{9}$/.test(phone)) {
    return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
  }
  return phone;
}

const EARTH_R = 6371;
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(s));
}

export function optionsKey(productId: string, options: CartOption[], notes?: string) {
  const sig = options
    .map((o) => `${o.group}:${o.item}`)
    .sort()
    .join("|");
  return `${productId}__${sig}__${notes ?? ""}`;
}

export function optionsSummary(options: CartOption[]) {
  return options.map((o) => o.item).join(", ");
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function todayHours(hours: HoursSettings, date = new Date()) {
  return hours[DAY_KEYS[date.getDay()] as keyof HoursSettings] as
    | { open: string; close: string }
    | null;
}

export function isOpenNow(hours: HoursSettings, date = new Date()) {
  const iso = date.toISOString().slice(0, 10);
  if (hours.closed_dates?.includes(iso)) return false;
  const today = todayHours(hours, date);
  if (!today) return false;
  const [oh, om] = today.open.split(":").map(Number);
  const [ch, cm] = today.close.split(":").map(Number);
  const mins = date.getHours() * 60 + date.getMinutes();
  return mins >= oh * 60 + om && mins < ch * 60 + cm;
}

export function timeAgo(from: string | Date, to = new Date()) {
  const ms = to.getTime() - new Date(from).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "acum câteva secunde";
  if (min === 1) return "acum 1 minut";
  if (min < 60) return `acum ${min} minute`;
  const h = Math.floor(min / 60);
  if (h === 1) return "acum o oră";
  if (h < 24) return `acum ${h} ore`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ieri" : `acum ${d} zile`;
}

export function minutesSince(from: string | Date, to = new Date()) {
  return Math.floor((to.getTime() - new Date(from).getTime()) / 60000);
}

export function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(value: string | Date) {
  return new Date(value).toLocaleTimeString("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateRo(value: string | Date) {
  return new Date(value).toLocaleDateString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  new: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "out_for_delivery", "cancelled"],
  ready: ["completed", "cancelled"],
  out_for_delivery: ["completed", "cancelled"],
  completed: ["refunded"],
  cancelled: [],
  refunded: [],
};
