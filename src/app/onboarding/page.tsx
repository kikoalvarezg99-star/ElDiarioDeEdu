"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { friendly } from "@/lib/errors";
import { Card, Field, Splash, btn, inputCls } from "@/components/ui";

export default function OnboardingPage() {
  const router = useRouter();
  const { session, profile, loading, refresh, signOut } = useAuth();
  // true = todavía no hay consulta: esta cuenta será la del dietista
  const [setup, setSetup] = useState<boolean | null>(null);
  const [clinic, setClinic] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login/");
    else if (profile) router.replace("/");
  }, [loading, session, profile, router]);

  useEffect(() => {
    if (!session || profile) return;
    let active = true;
    supabase.rpc("setup_available").then(({ data, error: err }) => {
      if (!active) return;
      if (err) {
        setError(
          "No se ha podido comprobar la configuración. Revisa que la actualización 002 esté ejecutada en Supabase.",
        );
        setSetup(false);
      } else {
        setSetup(data === true);
      }
    });
    return () => {
      active = false;
    };
  }, [session, profile]);

  if (loading || !session || profile || setup === null) return <Splash />;

  async function createClinic(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("create_clinic", {
      p_name: clinic.trim(),
      p_first: first.trim(),
      p_last: last.trim(),
    });
    if (err) {
      setError(friendly(err.message));
      setBusy(false);
      return;
    }
    await refresh();
    router.replace("/");
  }

  async function claim(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("claim_invite", {
      p_code: code.trim().toLowerCase(),
    });
    if (err) {
      setError(friendly(err.message));
      setBusy(false);
      return;
    }
    await refresh();
    router.replace("/");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 py-10">
      {setup ? (
        <>
          <h1 className="text-2xl font-bold text-brand">Configura tu consulta</h1>
          <p className="text-sm text-ink/70">
            Eres la primera persona en entrar, así que esta cuenta será la del
            dietista, con acceso a todos los clientes.
          </p>
          <Card>
            <form onSubmit={createClinic} className="space-y-3">
              <Field label="Nombre de la consulta">
                <input
                  required
                  value={clinic}
                  onChange={(e) => setClinic(e.target.value)}
                  className={inputCls}
                  placeholder="Eduardo Rivero Nutrición"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tu nombre">
                  <input
                    required
                    value={first}
                    onChange={(e) => setFirst(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Apellidos">
                  <input
                    value={last}
                    onChange={(e) => setLast(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button disabled={busy} className={`${btn} w-full`}>
                {busy ? "Creando…" : "Crear consulta"}
              </button>
            </form>
          </Card>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-brand">Bienvenido</h1>
          <p className="text-sm text-ink/70">
            Introduce el código de invitación que te ha dado tu dietista para
            entrar en tu espacio privado.
          </p>
          <Card>
            <form onSubmit={claim} className="space-y-3">
              <Field label="Código de invitación">
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`${inputCls} font-mono tracking-wider`}
                  placeholder="a1b2c3d4e5f60718"
                  autoCapitalize="none"
                />
              </Field>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button disabled={busy} className={`${btn} w-full`}>
                {busy ? "Comprobando…" : "Entrar en mi espacio"}
              </button>
            </form>
          </Card>
        </>
      )}

      <div className="text-right text-xs text-ink/60">
        <button onClick={() => void signOut()} className="underline">
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
