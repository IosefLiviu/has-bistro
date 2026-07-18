"use client";

import { Logo } from "@/components/logo";
import { Button, Field, Input, Spinner } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const supa = supabaseBrowser();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email sau parolă greșite.");
      setBusy(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="grid min-h-svh place-items-center bg-ink px-4">
      <form onSubmit={submit} className="card-surface w-full max-w-sm p-8">
        <Logo className="mx-auto size-20" />
        <h1 className="mt-4 text-center font-display text-xl font-extrabold">
          Panou de administrare
        </h1>
        <p className="mt-1 text-center text-sm text-mute">HASH Bistro &amp; Take Away</p>
        <div className="mt-6 flex flex-col gap-4">
          <Field label="Email">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>
          <Field label="Parolă">
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          {error && (
            <p className="rounded-xl border border-brick/50 bg-brick/10 px-4 py-2.5 text-sm text-brick">
              {error}
            </p>
          )}
          <Button size="lg" type="submit" disabled={busy}>
            {busy ? <Spinner /> : "Intră în panou"}
          </Button>
        </div>
      </form>
    </div>
  );
}
