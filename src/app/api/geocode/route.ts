import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { haversineKm } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/geocode?q=<adresă>
 * Geocodifică adresa (Nominatim/OSM, cache în DB) și verifică zona de livrare.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const latParam = req.nextUrl.searchParams.get("lat");
  const lngParam = req.nextUrl.searchParams.get("lng");

  const settings = await getSettings();
  const { lat: rLat, lng: rLng } = settings.restaurant;
  const { radius_km, fee, free_over } = settings.delivery;

  // mod direct: verificare zonă pentru coordonate deja cunoscute (adrese salvate)
  if (latParam && lngParam) {
    const plat = parseFloat(latParam);
    const plng = parseFloat(lngParam);
    if (Number.isFinite(plat) && Number.isFinite(plng)) {
      const distance = Math.round(haversineKm(rLat, rLng, plat, plng) * 100) / 100;
      return NextResponse.json({
        found: true,
        lat: plat,
        lng: plng,
        display_name: null,
        distance_km: distance,
        in_zone: distance <= radius_km,
        radius_km,
        delivery_fee: fee,
        free_over,
        glovo: settings.glovo,
      });
    }
  }

  if (q.length < 6) {
    return NextResponse.json({ found: false, reason: "short" });
  }

  const db = supabaseAdmin();
  const cacheKey = q.toLowerCase();

  let lat: number | null = null;
  let lng: number | null = null;
  let display: string | null = null;

  const { data: cached } = await db
    .from("geocode_cache")
    .select("lat,lng,display_name")
    .eq("query", cacheKey)
    .maybeSingle();

  if (cached) {
    lat = cached.lat;
    lng = cached.lng;
    display = cached.display_name;
  } else {
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", q);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "ro");
      url.searchParams.set("addressdetails", "0");
      const res = await fetch(url, {
        headers: {
          "User-Agent": "HASH-Bistro-Website/1.0 (comenzi online)",
          "Accept-Language": "ro",
        },
        // Nominatim cere maximum 1 req/s — cache-ul din DB ne ține departe de limită.
        next: { revalidate: 0 },
      });
      if (res.ok) {
        const results = (await res.json()) as Array<{
          lat: string;
          lon: string;
          display_name: string;
        }>;
        if (results[0]) {
          lat = parseFloat(results[0].lat);
          lng = parseFloat(results[0].lon);
          display = results[0].display_name;
        }
      }
      // salvăm și rezultatele „negăsite” ca să nu re-interogăm
      await db.from("geocode_cache").upsert({
        query: cacheKey,
        lat,
        lng,
        display_name: display,
      });
    } catch {
      return NextResponse.json({ found: false, reason: "network" }, { status: 200 });
    }
  }

  if (lat == null || lng == null) {
    return NextResponse.json({ found: false, reason: "not_found" });
  }

  const distance = Math.round(haversineKm(rLat, rLng, lat, lng) * 100) / 100;
  const inZone = distance <= radius_km;

  return NextResponse.json({
    found: true,
    lat,
    lng,
    display_name: display,
    distance_km: distance,
    in_zone: inZone,
    radius_km,
    delivery_fee: fee,
    free_over,
    glovo: settings.glovo,
  });
}
