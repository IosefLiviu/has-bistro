"use client";

import { Button } from "@/components/ui";
import { lei } from "@/lib/utils";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Loader2, Lock } from "lucide-react";
import { useMemo, useState } from "react";

function PayInner({
  orderId,
  total,
  onSuccess,
}: {
  orderId: string;
  total: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!stripe || !elements) return;
    setPaying(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/comanda/${orderId}?noua=1`,
      },
      redirect: "if_required",
    });
    if (result.error) {
      setError(result.error.message ?? "Plata nu a putut fi procesată.");
      setPaying(false);
    } else {
      onSuccess();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <p className="rounded-xl border border-brick/50 bg-brick/10 px-4 py-3 text-sm text-brick">
          {error}
        </p>
      )}
      <Button size="lg" className="w-full" onClick={pay} disabled={!stripe || paying}>
        {paying ? (
          <>
            <Loader2 className="size-5 animate-spin" /> Se procesează…
          </>
        ) : (
          <>
            <Lock className="size-4" /> Plătește {lei(total)}
          </>
        )}
      </Button>
    </div>
  );
}

export function StripePayment({
  clientSecret,
  orderId,
  total,
  onSuccess,
}: {
  clientSecret: string;
  orderId: string;
  total: number;
  onSuccess: () => void;
}) {
  const stripePromise = useMemo(
    () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!),
    []
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <div className="card-surface p-6">
        <h1 className="font-display text-xl font-extrabold">Plată securizată</h1>
        <p className="mb-6 mt-1 text-sm text-mute">
          Comanda ta este rezervată — finalizează plata pentru confirmare.
        </p>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "night",
              variables: {
                colorPrimary: "#e8b33c",
                colorBackground: "#1a1a1f",
                colorText: "#f5efe2",
                borderRadius: "12px",
                fontFamily: "Figtree, system-ui, sans-serif",
              },
            },
            locale: "ro",
          }}
        >
          <PayInner orderId={orderId} total={total} onSuccess={onSuccess} />
        </Elements>
      </div>
    </div>
  );
}
