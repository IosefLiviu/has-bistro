import { cache } from "react";
import { supabaseAdmin } from "./supabase/admin";
import type {
  DeliverySettings,
  GlovoSettings,
  HoursSettings,
  NotificationSettings,
  OrderingSettings,
  PrinterSettings,
  RestaurantSettings,
} from "./types";

export type AllSettings = {
  restaurant: RestaurantSettings;
  delivery: DeliverySettings;
  hours: HoursSettings;
  ordering: OrderingSettings;
  glovo: GlovoSettings;
  notifications: NotificationSettings;
  printer: PrinterSettings;
};

/** Citește toate setările (service role, cache per-request). */
export const getSettings = cache(async (): Promise<AllSettings> => {
  const db = supabaseAdmin();
  const { data, error } = await db.from("settings").select("key,value");
  if (error) throw new Error(`settings: ${error.message}`);
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return map as AllSettings;
});

export async function updateSetting(key: string, value: unknown) {
  const db = supabaseAdmin();
  const { error } = await db
    .from("settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
