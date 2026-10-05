"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Card, btn, btnGhost, inputCls } from "./ui";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { todayISO } from "@/lib/format";
import { fmtNum, num } from "@/lib/numbers";

/** Registro del peso de cada día (una vez al día; si ya hay uno, se corrige). */
export default function PesoDiario({
  clientId,
  onSaved,
}: {
  clientId: string;
  onSaved?: () => void;
}) {
  const [typeId, setTypeId] = useState<string | null>(null);
  const [today, setToday] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = await supabase
      .from("measurement_types")
      .select("id")
      .eq("code", "weight")
      .maybeSingle();
    const id = (t.data as { id: string } | null)?.id ?? null;
    setTypeId(id);
    if (id) {
      const m = await supabase
        .from("measurements")
        .select("value")
        .eq("client_id", clientId)
        .eq("type_id", id)
        .eq("measured_on", todayISO())
        .order("created_at", { ascending: false })
        .limit(1);
      const row = (m.data ?? [])[0] as { value: number } | undefined;
      setToday(row ? Number(row.value) : null);
    }
    setLoaded(true);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    const v = num(value);
    if (!typeId || Number.isNaN(v) || v < 20 || v > 400) {
      setError("Escribe tu peso en kilos, por ejemplo 72,4.");
      return;
    }
    setBusy(true);
    setError(null);

    if (today !== null) {
      // Corrección: se retira el registro de hoy hecho por el propio cliente.
      await supabase
        .from("measurements")
        .delete()
        .eq("client_id", clientId)
        .eq("type_id", typeId)
        .eq("measured_on", todayISO());
    }
    const { error: err } = await supabase.from("measurements").insert({
      client_id: clientId,
      type_id: typeId,
      value: v,
      measured_on: todayISO(),
    });
    if (err) setError(friendly(err.message));
    else {
      setValue("");
      setEditing(false);
      await load();
      onSaved?.();
    }
    setBusy(false);
  }

  if (!loaded) return null;

  return (
    <Card title="Tu peso de hoy">
      {today !== null && !editing ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <span className="mr-1 text-brand">✓</span>
            Hoy ya has registrado tu peso:{" "}
            <strong className="text-brand">{fmtNum(today, 1)} kg</strong>
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`${btnGhost} !py-1.5 text-xs`}
          >
            Corregir
          </button>
        </div>
      ) : (
        <form onSubmit={save} className="flex gap-2">
          <input
            required
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Tu peso en kg, p. ej. 72,4"
            className={inputCls}
          />
          <button disabled={busy} className={btn}>
            {busy ? "…" : "Guardar"}
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-3 text-xs text-ink/50">
        Pésate cada día a la misma hora, mejor por la mañana, en ayunas y sin
        ropa.
      </p>
    </Card>
  );
}
