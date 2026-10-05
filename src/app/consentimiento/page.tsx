"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Splash, btn, btnGhost } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { CONSENT_VERSION } from "@/lib/legal";

export default function ConsentimientoPage() {
  const { session, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login/");
    else if (profile && profile.role !== "client") router.replace("/panel/");
  }, [loading, session, profile, router]);

  if (loading || !session || !profile) return <Splash />;

  async function accept(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setError(null);
    const uid = session.user.id;
    const { error: err } = await supabase.from("consents").insert([
      { user_id: uid, kind: "privacy_policy", version: CONSENT_VERSION },
      { user_id: uid, kind: "health_data", version: CONSENT_VERSION },
    ]);
    if (err) {
      setError(friendly(err.message));
      setBusy(false);
      return;
    }
    router.replace("/hoy/");
  }

  return (
    <main className="mx-auto max-w-md p-5">
      <Card title="Antes de empezar">
        <form onSubmit={accept} className="space-y-4 text-sm">
          <p>
            Para darte seguimiento necesitamos tratar tus datos, incluidos los de salud (peso, medidas, fotos,
            planes, documentos y mensajes). Solo los verás tú y tu dietista.
          </p>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={a} onChange={(e) => setA(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#2c5036]" />
            <span>
              He leído la{" "}
              <Link href="/privacidad/" target="_blank" className="font-semibold text-brand underline">
                política de privacidad
              </Link>
              .
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={b} onChange={(e) => setB(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#2c5036]" />
            <span>
              Doy mi <strong>consentimiento explícito</strong> para que se traten mis datos de salud con la
              finalidad de mi seguimiento nutricional. Puedo retirarlo cuando quiera.
            </span>
          </label>
          {error && <p className="text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button disabled={!a || !b || busy} className={btn}>
              {busy ? "Guardando…" : "Aceptar y continuar"}
            </button>
            <button type="button" onClick={() => void signOut()} className={btnGhost}>
              Salir
            </button>
          </div>
        </form>
      </Card>
    </main>
  );
}
