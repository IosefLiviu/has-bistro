import { CheckoutForm, type CheckoutPrefill } from "@/components/checkout/checkout-form";
import { getSettings } from "@/lib/settings";
import { stripeEnabled } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Finalizează comanda",
};

export default async function CheckoutPage() {
  const settings = await getSettings();

  const prefill: CheckoutPrefill = { addresses: [], loggedIn: false };
  try {
    const supa = await supabaseServer();
    const {
      data: { user },
    } = await supa.auth.getUser();
    if (user) {
      prefill.loggedIn = true;
      prefill.email = user.email ?? undefined;
      const db = supabaseAdmin();
      const { data: customer } = await db
        .from("customers")
        .select("id,name,phone,email")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (customer) {
        prefill.name = customer.name || undefined;
        prefill.phone = customer.phone || undefined;
        prefill.email = customer.email ?? prefill.email;
        const { data: addresses } = await db
          .from("customer_addresses")
          .select("id,street,details,city,lat,lng")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(5);
        prefill.addresses = addresses ?? [];
      }
    }
  } catch {
    // vizitator
  }

  return (
    <div className="pt-24 pb-10">
      <header className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <p className="font-script text-3xl text-gold/90">mai e un pas</p>
        <h1 className="mt-1 font-display text-4xl font-extrabold">Finalizează comanda</h1>
      </header>
      <CheckoutForm
        delivery={settings.delivery}
        ordering={settings.ordering}
        hours={settings.hours}
        glovo={settings.glovo}
        stripeReady={stripeEnabled()}
        restaurantAddress={settings.restaurant.address_label}
        prefill={prefill}
      />
    </div>
  );
}
