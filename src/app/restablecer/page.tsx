"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { base, btn, inputCls } from "@/components/ui";

type Stage = "wait" | "form" | "invalid" | "done";

/** Página a la que llega el enlace del correo para elegir una contraseña nueva. */
export default function RestablecerPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("wait");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      // Flujo con código: se intercambia por una sesión. Si supabase-js ya lo
      // hizo por su cuenta, el error se ignora.
      supabase.auth.exchangeCodeForSession(code).catch(() => undefined);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && s)) {
        setStage((cur) => (cur === "done" ? cur : "form"));
      }
    });

    // Si pasado un momento no hay sesión, el enlace no es válido o ha caducado.
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setStage((cur) =>
        cur === "wait" ? (data.session ? "form" : "invalid") : cur,
      );
    }, 2500);

    return () => {
      active = false;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== repeat) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(friendly(err.message));
      setBusy(false);
      return;
    }
    setStage("done");
    setBusy(false);
    setTimeout(() => router.replace("/"), 1500);
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
        {stage === "wait" && (
          <p className="text-sm text-ink/70">Comprobando el enlace…</p>
        )}

        {stage === "invalid" && (
          <div className="space-y-3">
            <h1 className="text-lg font-bold text-brand">Enlace no válido</h1>
            <p className="text-sm text-ink/70">
              El enlace ha caducado o ya se ha usado. Pide uno nuevo desde la
              pantalla de entrada.
            </p>
            <button onClick={() => router.replace("/login/")} className={`${btn} w-full`}>
              Volver a entrar
            </button>
          </div>
        )}

        {stage === "form" && (
          <form onSubmit={submit} className="space-y-3">
            <h1 className="text-lg font-bold text-brand">Elige tu nueva contraseña</h1>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Nueva contraseña (mínimo 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Repite la contraseña"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className={inputCls}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={busy} className={`${btn} w-full`}>
              {busy ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}

        {stage === "done" && (
          <p className="text-sm text-brand">
            Contraseña cambiada. Te llevamos a la aplicación…
          </p>
        )}
      </div>
    </div>
  );
}
