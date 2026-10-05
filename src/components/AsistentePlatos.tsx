"use client";

import { useEffect, useState } from "react";
import { Card, Field, btn, inputCls } from "./ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { CONSENT_VERSION } from "@/lib/legal";
import { SLOTS, dow } from "@/lib/plan";

/** Ideas de platos con IA, dentro del plan del día. Solo sugiere; no cambia el plan. */
export default function AsistentePlatos() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [consent, setConsent] = useState<boolean | null>(null);
  const [agree, setAgree] = useState(false);
  const [slot, setSlot] = useState("lunch");
  const [extra, setExtra] = useState("");
  const [text, setText] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    supabase
      .from("consents")
      .select("id")
      .eq("user_id", uid)
      .eq("kind", "ai_assistant")
      .eq("version", CONSENT_VERSION)
      .limit(1)
      .then(({ data }) => setConsent((data ?? []).length > 0));
  }, [uid]);

  async function accept() {
    if (!uid) return;
    const { error: err } = await supabase
      .from("consents")
      .insert({ user_id: uid, kind: "ai_assistant", version: CONSENT_VERSION });
    if (err) setError(friendly(err.message));
    else setConsent(true);
  }

  async function ask() {
    setBusy(true);
    setError(null);
    setText(null);
    const { data, error: err } = await supabase.functions.invoke("ai-platos", {
      body: { slot, day: dow(new Date()), extra },
    });
    if (err) {
      // Intenta leer el mensaje que devuelve la función
      let m = "El asistente aún no está activado.";
      try {
        const ctx = (err as { context?: Response }).context;
        if (ctx) m = ((await ctx.json()) as { error?: string }).error ?? m;
      } catch {
        // se queda el mensaje por defecto
      }
      setError(m);
    } else {
      const d = data as { text?: string; remaining?: number };
      setText(d.text ?? null);
      setRemaining(d.remaining ?? null);
    }
    setBusy(false);
  }

  if (consent === null) return null;

  return (
    <Card title="Ideas de platos con IA">
      {!consent ? (
        <div className="space-y-3 text-sm">
          <p>
            Te propone ideas de platos que encajan con tu plan de hoy. Solo sugiere: <strong>no cambia tu plan</strong>{" "}
            y no sustituye a tu dietista.
          </p>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#2c5036]" />
            <span>
              Entiendo que el texto de mi plan del día y lo que escriba se envían a un servicio de IA de Google
              (Gemini) para generar la respuesta. No se envía mi nombre, mis fotos ni mis medidas, y no debo escribir
              datos personales.
            </span>
          </label>
          <button disabled={!agree} onClick={() => void accept()} className={btn}>
            Activar asistente
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="¿Para qué comida?">
              <select value={slot} onChange={(e) => setSlot(e.target.value)} className={inputCls}>
                {SLOTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Qué tienes en casa (opcional)">
              <input
                value={extra}
                maxLength={300}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="pollo, arroz, calabacín…"
                className={inputCls}
              />
            </Field>
          </div>
          <button disabled={busy} onClick={() => void ask()} className={btn}>
            {busy ? "Pensando…" : "Sugerir platos"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {text && (
            <div className="rounded-xl bg-brand-soft/60 p-4 text-sm">
              <p className="whitespace-pre-wrap">{text}</p>
              <p className="mt-3 text-xs text-ink/50">
                Sugerencias orientativas generadas por IA. Sigue tu plan y consulta a tu dietista ante cualquier duda.
                {remaining !== null && ` Te quedan ${remaining} consultas hoy.`}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
