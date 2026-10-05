"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { friendly } from "@/lib/errors";
import { base, btn, inputCls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) router.replace("/");
  }, [loading, session, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    if (mode === "in") {
      const { error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (err) setError(friendly(err.message));
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
      });
      if (err) setError(friendly(err.message));
      else if (!data.session)
        setInfo(
          "Te hemos enviado un correo para confirmar tu cuenta. Ábrelo y vuelve aquí para entrar.",
        );
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand px-4 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${base}/logo-full.svg`}
        alt="Eduardo Rivero"
        className="mb-6 w-36 rounded-2xl"
      />
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-5 grid grid-cols-2 rounded-xl bg-brand-soft p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setMode("in")}
            className={`rounded-lg py-2 ${mode === "in" ? "bg-white text-brand shadow-sm" : "text-brand/60"}`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("up")}
            className={`rounded-lg py-2 ${mode === "up" ? "bg-white text-brand shadow-sm" : "text-brand/60"}`}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            placeholder="Contraseña (mínimo 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-brand">{info}</p>}
          <button type="submit" disabled={busy} className={`${btn} w-full`}>
            {busy ? "Un momento…" : mode === "in" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        {mode === "up" && (
          <p className="mt-4 text-xs leading-relaxed text-ink/60">
            Si eres cliente, crea tu cuenta aquí y en el siguiente paso
            introduce el código que te ha dado tu dietista.
          </p>
        )}
      </div>
    </div>
  );
}
