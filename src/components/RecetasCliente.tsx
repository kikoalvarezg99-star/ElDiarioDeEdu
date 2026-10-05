"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, btn, inputCls } from "./ui";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";

type R = { id: string; name: string };

/** Recetas asignadas a un cliente (vista del dietista). */
export default function RecetasCliente({ clientId }: { clientId: string }) {
  const [all, setAll] = useState<R[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, a] = await Promise.all([
      supabase.from("recipes").select("id,name").order("name"),
      supabase.from("recipe_assignments").select("recipe_id").eq("client_id", clientId),
    ]);
    setAll((r.data ?? []) as unknown as R[]);
    setAssigned(((a.data ?? []) as unknown as { recipe_id: string }[]).map((x) => x.recipe_id));
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function assign() {
    if (!pick) return;
    setError(null);
    const { error: err } = await supabase
      .from("recipe_assignments")
      .insert({ recipe_id: pick, client_id: clientId });
    if (err) setError(friendly(err.message));
    setPick("");
    await load();
  }

  async function unassign(id: string) {
    const { error: err } = await supabase
      .from("recipe_assignments")
      .delete()
      .eq("recipe_id", id)
      .eq("client_id", clientId);
    if (err) setError(friendly(err.message));
    await load();
  }

  const mine = all.filter((r) => assigned.includes(r.id));
  const free = all.filter((r) => !assigned.includes(r.id));

  return (
    <Card title="Recetas asignadas">
      <div className="space-y-3">
        {mine.length === 0 ? (
          <p className="text-sm text-ink/50">Ninguna receta asignada.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {mine.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span>{r.name}</span>
                <button type="button" onClick={() => void unassign(r.id)} className="text-xs text-red-600 underline">
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        {free.length > 0 ? (
          <div className="flex gap-2">
            <select value={pick} onChange={(e) => setPick(e.target.value)} className={inputCls}>
              <option value="">Elegir receta…</option>
              {free.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button type="button" disabled={!pick} onClick={() => void assign()} className={btn}>
              Asignar
            </button>
          </div>
        ) : (
          all.length === 0 && (
            <p className="text-xs text-ink/50">
              Primero crea recetas en{" "}
              <Link href="/recetas/" className="font-semibold text-brand underline">
                Recetas
              </Link>
              .
            </p>
          )
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Card>
  );
}
