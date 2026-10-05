"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import LineChart from "./LineChart";
import { Card, Field, btn, btnGhost, inputCls } from "./ui";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { fmtDate, todayISO } from "@/lib/format";
import { bmiCategory, fmtNum, num } from "@/lib/numbers";

type MType = { id: string; code: string | null; name: string; unit: string };
type Meas = {
  id: string;
  type_id: string;
  value: number;
  measured_on: string;
  source: string;
};

/**
 * Evolución de un cliente: gráfica, registro de valores e historial.
 * `staff` = true para el dietista/administrador (puede borrar y crear
 * parámetros nuevos); false para el propio cliente.
 */
export default function Evolucion({
  clientId,
  heightCm,
  staff,
}: {
  clientId: string;
  heightCm: number | null;
  staff: boolean;
}) {
  const [types, setTypes] = useState<MType[]>([]);
  const [rows, setRows] = useState<Meas[]>([]);
  const [typeId, setTypeId] = useState("");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayISO());
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [t, m] = await Promise.all([
      supabase.from("measurement_types").select("id,code,name,unit").order("name"),
      supabase
        .from("measurements")
        .select("id,type_id,value,measured_on,source")
        .eq("client_id", clientId)
        .order("measured_on", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);
    const ts = (t.data ?? []) as unknown as MType[];
    // El peso siempre primero
    ts.sort((a, b) => (a.code === "weight" ? -1 : b.code === "weight" ? 1 : a.name.localeCompare(b.name)));
    setTypes(ts);
    setRows((m.data ?? []) as unknown as Meas[]);
    setTypeId((cur) => cur || ts[0]?.id || "");
    setLoaded(true);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = types.find((t) => t.id === typeId);
  const points = useMemo(
    () =>
      rows
        .filter((r) => r.type_id === typeId)
        .map((r) => ({ id: r.id, source: r.source, date: r.measured_on, value: Number(r.value) })),
    [rows, typeId],
  );
  const first = points[0];
  const last = points[points.length - 1];

  const bmi =
    current?.code === "weight" && heightCm && last
      ? last.value / Math.pow(heightCm / 100, 2)
      : null;

  async function add(e: FormEvent) {
    e.preventDefault();
    const v = num(value);
    if (!typeId || Number.isNaN(v) || v <= 0) {
      setError("Escribe un valor numérico válido.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("measurements")
      .insert({ client_id: clientId, type_id: typeId, value: v, measured_on: date });
    if (err) setError(friendly(err.message));
    else {
      setValue("");
      await load();
    }
    setBusy(false);
  }

  async function remove(id: string) {
    if (!window.confirm("¿Borrar este registro?")) return;
    const { error: err } = await supabase.from("measurements").delete().eq("id", id);
    if (err) setError(friendly(err.message));
    else await load();
  }

  async function addType(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newUnit.trim()) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("measurement_types")
      .insert({ name: newName.trim(), unit: newUnit.trim() });
    if (err) setError(friendly(err.message));
    else {
      setNewName("");
      setNewUnit("");
      await load();
    }
    setBusy(false);
  }

  return (
    <Card title="Evolución">
      {!loaded ? (
        <p className="text-sm text-ink/50">Cargando…</p>
      ) : types.length === 0 ? (
        <p className="text-sm text-ink/50">No hay parámetros configurados.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeId(t.id)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  t.id === typeId
                    ? "bg-brand text-white"
                    : "bg-brand-soft text-brand hover:bg-brand-soft/70"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          {current && points.length > 0 && (
            <div className="text-sm">
              <p className="font-semibold text-brand">
                {points
                  .slice(-5)
                  .map((p) => fmtNum(p.value, 1))
                  .join(" → ")}{" "}
                {current.unit}
              </p>
              {points.length > 1 && (
                <p className="text-ink/60">
                  Cambio total:{" "}
                  {last.value - first.value > 0 ? "+" : ""}
                  {fmtNum(last.value - first.value, 1)} {current.unit}
                </p>
              )}
              {bmi !== null && (
                <p className="text-ink/60">
                  IMC actual: <strong>{fmtNum(bmi, 1)}</strong> ({bmiCategory(bmi)})
                </p>
              )}
              {current.code === "weight" && !heightCm && (
                <p className="text-xs text-ink/50">
                  Añade la altura en la ficha para calcular el IMC.
                </p>
              )}
            </div>
          )}

          <div className="text-ink">
            <LineChart points={points} unit={current?.unit ?? ""} />
          </div>

          <form onSubmit={add} className="grid gap-3 rounded-xl bg-brand-soft/50 p-4 sm:grid-cols-4">
            <Field label="Parámetro">
              <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputCls}>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.unit})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Valor">
              <input
                required
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="72,4"
                className={inputCls}
              />
            </Field>
            <Field label="Fecha">
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </Field>
            <div className="flex items-end">
              <button disabled={busy} className={`${btn} w-full`}>
                Añadir
              </button>
            </div>
          </form>
          {error && <p className="text-sm text-red-600">{error}</p>}

          {points.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand/70">
                Historial
              </h3>
              <ul className="divide-y divide-black/5">
                {[...points].reverse().slice(0, 12).map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <strong>{fmtNum(p.value, 2)} {current?.unit}</strong>
                      <span className="ml-2 text-ink/50">{fmtDate(p.date)}</span>
                      <span className="ml-2 text-xs text-ink/40">
                        {p.source === "client" ? "lo registró el cliente" : "registrado por el equipo"}
                      </span>
                    </span>
                    {staff && (
                      <button
                        type="button"
                        onClick={() => void remove(p.id)}
                        className="text-xs text-red-600 underline"
                      >
                        Borrar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {staff && (
            <details className="rounded-xl ring-1 ring-black/10">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-brand">
                Añadir un parámetro nuevo (por ejemplo, «Muslo» en cm)
              </summary>
              <form onSubmit={addType} className="grid gap-3 p-4 sm:grid-cols-3">
                <Field label="Nombre">
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Unidad">
                  <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="cm" className={inputCls} />
                </Field>
                <div className="flex items-end">
                  <button disabled={busy} className={`${btnGhost} w-full`}>
                    Crear parámetro
                  </button>
                </div>
              </form>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}
