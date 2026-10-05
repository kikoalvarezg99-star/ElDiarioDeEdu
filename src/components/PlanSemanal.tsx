"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Card, btn, btnGhost, inputCls } from "./ui";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { DAYS, DAYS_LONG, SLOTS, dow, iso, type PlanItem } from "@/lib/plan";

type Plan = { id: string; name: string };
type Rec = { id: string; name: string };

/** Editor del plan semanal de un cliente (dietista / administrador). */
export default function PlanSemanal({ clientId }: { clientId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [recipes, setRecipes] = useState<Rec[]>([]);
  const [day, setDay] = useState(1);
  const [name, setName] = useState("Plan semanal");
  const [drafts, setDrafts] = useState<Record<string, { text: string; recipe: string }>>({});
  const [adherence, setAdherence] = useState<{ date: string; done: number; total: number }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const p = await supabase
      .from("meal_plans")
      .select("id,name")
      .eq("client_id", clientId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);
    const row = ((p.data ?? [])[0] as Plan | undefined) ?? null;
    setPlan(row);
    const r = await supabase.from("recipes").select("id,name").order("name");
    setRecipes((r.data ?? []) as unknown as Rec[]);
    if (row) {
      const it = await supabase
        .from("meal_plan_items")
        .select("id,day_of_week,slot,description,recipe_id,position")
        .eq("plan_id", row.id)
        .order("position");
      const list = (it.data ?? []) as unknown as PlanItem[];
      setItems(list);

      // Cumplimiento de los últimos 7 días
      const from = new Date();
      from.setDate(from.getDate() - 6);
      const lg = await supabase
        .from("meal_logs")
        .select("item_id,log_date,completed")
        .eq("client_id", clientId)
        .gte("log_date", iso(from));
      const logs = (lg.data ?? []) as unknown as { item_id: string; log_date: string; completed: boolean }[];
      const out: { date: string; done: number; total: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ids = list.filter((x) => x.day_of_week === dow(d)).map((x) => x.id);
        const key = iso(d);
        out.push({
          date: key,
          total: ids.length,
          done: logs.filter((l) => l.log_date === key && l.completed && ids.includes(l.item_id)).length,
        });
      }
      setAdherence(out);
    } else {
      setItems([]);
      setAdherence([]);
    }
    setLoaded(true);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPlan(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("meal_plans")
      .insert({ client_id: clientId, name: name.trim() || "Plan semanal", status: "active" });
    if (err) setError(friendly(err.message));
    await load();
    setBusy(false);
  }

  async function deletePlan() {
    if (!plan || !window.confirm("¿Borrar el plan completo? El cliente dejará de verlo.")) return;
    const { error: err } = await supabase.from("meal_plans").delete().eq("id", plan.id);
    if (err) setError(friendly(err.message));
    await load();
  }

  async function addItem(slot: string) {
    if (!plan) return;
    const d = drafts[slot] ?? { text: "", recipe: "" };
    const rname = recipes.find((r) => r.id === d.recipe)?.name ?? "";
    const description = d.text.trim() || rname;
    if (!description) {
      setError("Escribe qué comer o elige una receta.");
      return;
    }
    setError(null);
    const { error: err } = await supabase.from("meal_plan_items").insert({
      plan_id: plan.id,
      day_of_week: day,
      slot,
      description,
      recipe_id: d.recipe || null,
      position: items.filter((i) => i.day_of_week === day && i.slot === slot).length,
    });
    if (err) {
      setError(friendly(err.message));
      return;
    }
    setDrafts((s) => ({ ...s, [slot]: { text: "", recipe: "" } }));
    await load();
  }

  async function removeItem(id: string) {
    const { error: err } = await supabase.from("meal_plan_items").delete().eq("id", id);
    if (err) setError(friendly(err.message));
    await load();
  }

  async function copyDay() {
    if (!plan) return;
    const src = items.filter((i) => i.day_of_week === day);
    if (src.length === 0) return;
    if (!window.confirm(`¿Copiar el ${DAYS_LONG[day - 1].toLowerCase()} a todos los demás días? Se sustituirá lo que haya en ellos.`)) return;
    setBusy(true);
    setError(null);
    const others = [1, 2, 3, 4, 5, 6, 7].filter((d) => d !== day);
    const del = await supabase
      .from("meal_plan_items")
      .delete()
      .eq("plan_id", plan.id)
      .in("day_of_week", others);
    if (del.error) {
      setError(friendly(del.error.message));
      setBusy(false);
      return;
    }
    const rows = others.flatMap((d) =>
      src.map((i) => ({
        plan_id: plan.id,
        day_of_week: d,
        slot: i.slot,
        description: i.description,
        recipe_id: i.recipe_id,
        position: i.position,
      })),
    );
    const ins = await supabase.from("meal_plan_items").insert(rows);
    if (ins.error) setError(friendly(ins.error.message));
    await load();
    setBusy(false);
  }

  if (!loaded) return null;

  if (!plan) {
    return (
      <Card title="Plan semanal">
        <form onSubmit={createPlan} className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Nombre del plan" />
          <button disabled={busy} className={btn}>
            Crear plan
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <p className="mt-2 text-xs text-ink/50">
          El cliente verá el plan en su pantalla «Hoy» y marcará cada comida como hecha.
        </p>
      </Card>
    );
  }

  const dayItems = items.filter((i) => i.day_of_week === day);

  return (
    <Card title={`Plan semanal · ${plan.name}`}>
      <div className="space-y-4">
        {adherence.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand/70">Cumplimiento (últimos 7 días)</p>
            <div className="flex gap-1.5">
              {adherence.map((a) => (
                <div key={a.date} className="flex-1 rounded-lg bg-brand-soft px-1 py-1.5 text-center">
                  <p className="text-[10px] text-ink/50">{a.date.slice(8, 10)}/{a.date.slice(5, 7)}</p>
                  <p className="text-sm font-semibold text-brand">{a.total ? `${a.done}/${a.total}` : "–"}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(i + 1)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                day === i + 1 ? "bg-brand text-white" : "bg-brand-soft text-brand"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {SLOTS.map((s) => {
            const list = dayItems.filter((i) => i.slot === s.key);
            const d = drafts[s.key] ?? { text: "", recipe: "" };
            return (
              <div key={s.key}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand/70">{s.label}</h3>
                {list.length > 0 && (
                  <ul className="mb-2 divide-y divide-black/5 rounded-xl ring-1 ring-black/5">
                    {list.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span>{i.description}</span>
                        <button type="button" onClick={() => void removeItem(i.id)} className="text-xs text-red-600 underline">
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
                  <input
                    value={d.text}
                    onChange={(e) => setDrafts((x) => ({ ...x, [s.key]: { ...d, text: e.target.value } }))}
                    placeholder="Ej.: 40 g de avena con yogur y fruta"
                    className={inputCls}
                  />
                  <select
                    value={d.recipe}
                    onChange={(e) => setDrafts((x) => ({ ...x, [s.key]: { ...d, recipe: e.target.value } }))}
                    className={inputCls}
                  >
                    <option value="">Sin receta</option>
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => void addItem(s.key)} className={btnGhost}>
                    Añadir
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy || dayItems.length === 0} onClick={() => void copyDay()} className={btnGhost}>
            Copiar este día a todos los demás
          </button>
          <button type="button" onClick={() => void deletePlan()} className="text-xs text-red-600 underline">
            Borrar plan
          </button>
        </div>
      </div>
    </Card>
  );
}
