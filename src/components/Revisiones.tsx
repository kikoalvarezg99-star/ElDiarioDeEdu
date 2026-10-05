"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Card, Field, btn, inputCls } from "./ui";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { fmtDate, todayISO } from "@/lib/format";
import { fmtNum, num } from "@/lib/numbers";

type MType = { id: string; code: string | null; name: string; unit: string };
type RevMeas = {
  value: number;
  measurement_types: { name: string; unit: string } | { name: string; unit: string }[] | null;
};
type Review = {
  id: string;
  reviewed_on: string;
  weight_kg: number | null;
  observations: string | null;
  next_review_on: string | null;
  review_measurements: RevMeas[] | null;
};

const one = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? (x[0] ?? null) : x);

/** Revisiones del cliente (solo para el equipo): historial completo. */
export default function Revisiones({
  clientId,
  onSaved,
}: {
  clientId: string;
  onSaved?: () => void;
}) {
  const [types, setTypes] = useState<MType[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [obs, setObs] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [t, r] = await Promise.all([
      supabase.from("measurement_types").select("id,code,name,unit").order("name"),
      supabase
        .from("reviews")
        .select(
          "id,reviewed_on,weight_kg,observations,next_review_on,review_measurements(value,measurement_types(name,unit))",
        )
        .eq("client_id", clientId)
        .order("reviewed_on", { ascending: false }),
    ]);
    setTypes((t.data ?? []) as unknown as MType[]);
    setReviews((r.data ?? []) as unknown as Review[]);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const weightType = types.find((t) => t.code === "weight");
  const otherTypes = types.filter((t) => t.code !== "weight");

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const w = weight.trim() ? num(weight) : null;
    if (w !== null && (Number.isNaN(w) || w <= 0)) {
      setError("El peso no es un número válido.");
      return;
    }
    const extra = Object.entries(vals)
      .filter(([, v]) => v.trim() !== "")
      .map(([type_id, v]) => ({ type_id, value: num(v) }));
    if (extra.some((x) => Number.isNaN(x.value) || x.value <= 0)) {
      setError("Alguna medida no es un número válido.");
      return;
    }

    setBusy(true);
    const { data, error: err } = await supabase
      .from("reviews")
      .insert({
        client_id: clientId,
        reviewed_on: date,
        weight_kg: w,
        observations: obs.trim() || null,
        next_review_on: next || null,
      })
      .select("id")
      .single();
    if (err || !data) {
      setError(friendly(err?.message ?? "No se pudo guardar la revisión"));
      setBusy(false);
      return;
    }
    const rid = (data as { id: string }).id;

    if (extra.length > 0) {
      const { error: e2 } = await supabase
        .from("review_measurements")
        .insert(extra.map((x) => ({ review_id: rid, type_id: x.type_id, value: x.value })));
      if (e2) setError(friendly(e2.message));
    }

    // Los valores de la revisión también alimentan las gráficas de evolución.
    const feed = [
      ...(w !== null && weightType ? [{ type_id: weightType.id, value: w }] : []),
      ...extra,
    ].map((x) => ({
      client_id: clientId,
      type_id: x.type_id,
      value: x.value,
      measured_on: date,
    }));
    if (feed.length > 0) {
      const { error: e3 } = await supabase.from("measurements").insert(feed);
      if (e3) setError(friendly(e3.message));
    }

    setWeight("");
    setVals({});
    setObs("");
    setNext("");
    setOpen(false);
    await load();
    onSaved?.();
    setBusy(false);
  }

  return (
    <Card title="Seguimiento · Revisiones">
      <div className="space-y-4">
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className={btn}>
            Nueva revisión
          </button>
        ) : (
          <form onSubmit={save} className="grid gap-3 rounded-xl bg-brand-soft/50 p-4 sm:grid-cols-2">
            <Field label="Fecha de la revisión">
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Peso (kg)">
              <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="82,4" className={inputCls} />
            </Field>
            {otherTypes.map((t) => (
              <Field key={t.id} label={`${t.name} (${t.unit})`}>
                <input
                  inputMode="decimal"
                  value={vals[t.id] ?? ""}
                  onChange={(e) => setVals((v) => ({ ...v, [t.id]: e.target.value }))}
                  className={inputCls}
                />
              </Field>
            ))}
            <div className="sm:col-span-2">
              <Field label="Observaciones">
                <textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Próxima revisión">
              <input type="date" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
            </Field>
            {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
            <div className="flex gap-2 sm:col-span-2">
              <button disabled={busy} className={btn}>
                {busy ? "Guardando…" : "Guardar revisión"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink/60"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {reviews.length === 0 ? (
          <p className="text-sm text-ink/50">Todavía no hay revisiones registradas.</p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-xl p-4 ring-1 ring-black/10">
                <p className="text-sm font-bold text-brand">
                  REVISIÓN — {fmtDate(r.reviewed_on)}
                </p>
                <div className="mt-2 space-y-0.5 text-sm">
                  {r.weight_kg !== null && (
                    <p>
                      Peso: <strong>{fmtNum(Number(r.weight_kg), 2)} kg</strong>
                    </p>
                  )}
                  {(r.review_measurements ?? []).map((m, i) => {
                    const mt = one(m.measurement_types);
                    return (
                      <p key={i}>
                        {mt?.name}: <strong>{fmtNum(Number(m.value), 2)} {mt?.unit}</strong>
                      </p>
                    );
                  })}
                </div>
                {r.observations && (
                  <p className="mt-2 text-sm italic text-ink/70">«{r.observations}»</p>
                )}
                {r.next_review_on && (
                  <p className="mt-2 text-xs text-ink/60">
                    Próxima revisión: <strong>{fmtDate(r.next_review_on)}</strong>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
