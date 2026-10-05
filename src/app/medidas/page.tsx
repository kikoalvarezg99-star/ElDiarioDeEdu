"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Shell from "@/components/Shell";
import Evolucion from "@/components/Evolucion";
import CuerpoMedidas from "@/components/CuerpoMedidas";
import { Card, Field, btn, inputCls } from "@/components/ui";
import { PERIMETERS, PERIMETER_CODES } from "@/lib/medidas";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { todayISO } from "@/lib/format";
import { num } from "@/lib/numbers";

type MType = { id: string; code: string | null };

function MedidasContent() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [typeIds, setTypeIds] = useState<Record<string, string>>({});
  const [vals, setVals] = useState<Record<string, string>>({});
  const [date, setDate] = useState(todayISO());
  const [evoKey, setEvoKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, t] = await Promise.all([
      supabase.from("clients").select("id").maybeSingle(),
      supabase.from("measurement_types").select("id,code"),
    ]);
    setClientId((c.data as { id: string } | null)?.id ?? null);
    const map: Record<string, string> = {};
    ((t.data ?? []) as unknown as MType[]).forEach((x) => {
      if (x.code) map[x.code] = x.id;
    });
    setTypeIds(map);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!clientId) return;
    setError(null);
    setMsg(null);

    const filled = PERIMETERS.filter((p) => (vals[p.code] ?? "").trim() !== "");
    if (filled.length === 0) {
      setError("Escribe al menos una medida.");
      return;
    }
    const rows: { client_id: string; type_id: string; value: number; measured_on: string }[] = [];
    for (const p of filled) {
      const v = num(vals[p.code]);
      if (Number.isNaN(v) || v < 5 || v > 300) {
        setError(`La medida de ${p.label.toLowerCase()} no es válida (en centímetros).`);
        return;
      }
      const type_id = typeIds[p.code];
      if (!type_id) {
        setError(
          `Falta configurar «${p.label}». Avisa a tu dietista para que lo active.`,
        );
        return;
      }
      rows.push({ client_id: clientId, type_id, value: v, measured_on: date });
    }

    setBusy(true);
    const { error: err } = await supabase.from("measurements").insert(rows);
    if (err) setError(friendly(err.message));
    else {
      setVals({});
      setMsg("Medidas guardadas");
      setEvoKey((k) => k + 1);
    }
    setBusy(false);
  }

  if (!loaded) return <p className="text-sm text-ink/50">Cargando…</p>;
  if (!clientId) {
    return (
      <Card>
        <p className="text-sm">No se ha encontrado tu ficha. Avisa a tu dietista.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand">Mis medidas</h1>
        <p className="text-sm text-ink/60">
          Mide con una cinta métrica, de pie y relajado, sin apretar la cinta.
          Hazlo siempre a la misma hora, mejor por la mañana.
        </p>
      </div>

      <Card title="Registrar medidas (en cm)">
        <form onSubmit={save} className="grid gap-6 md:grid-cols-[220px_1fr]">
          <CuerpoMedidas />

          <div className="space-y-3">
            <Field label="Fecha">
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`${inputCls} sm:max-w-[200px]`}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              {PERIMETERS.map((p) => (
                <label key={p.code} className="block">
                  <span className="mb-1 flex items-center gap-2 text-sm font-semibold">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.label}
                  </span>
                  <input
                    inputMode="decimal"
                    value={vals[p.code] ?? ""}
                    onChange={(e) =>
                      setVals((v) => ({ ...v, [p.code]: e.target.value }))
                    }
                    placeholder="cm"
                    className={inputCls}
                  />
                  <span className="mt-1 block text-xs leading-snug text-ink/50">
                    {p.hint}
                  </span>
                </label>
              ))}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {msg && <p className="text-sm text-brand">{msg}</p>}
            <button disabled={busy} className={btn}>
              {busy ? "Guardando…" : "Guardar medidas"}
            </button>
          </div>
        </form>
      </Card>

      <Evolucion
        key={evoKey}
        clientId={clientId}
        heightCm={null}
        staff={false}
        only={PERIMETER_CODES}
        title="Tu evolución de medidas"
      />
    </div>
  );
}

export default function MedidasPage() {
  return (
    <Shell area="client">
      <MedidasContent />
    </Shell>
  );
}
