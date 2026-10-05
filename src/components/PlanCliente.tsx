"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "./ui";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { DAYS, DAYS_LONG, SLOTS, dow, iso, type PlanItem } from "@/lib/plan";

/** Plan del cliente: ve su semana y marca las comidas de hoy como hechas. */
export default function PlanCliente({ clientId }: { clientId: string }) {
  const today = new Date();
  const todayDow = dow(today);
  const todayKey = iso(today);

  const [name, setName] = useState<string | null>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [day, setDay] = useState(todayDow);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Por RLS, el cliente solo ve su plan activo.
    const p = await supabase
      .from("meal_plans")
      .select("id,name")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);
    const plan = (p.data ?? [])[0] as { id: string; name: string } | undefined;
    if (!plan) {
      setName(null);
      setItems([]);
      setLoaded(true);
      return;
    }
    setName(plan.name);
    const it = await supabase
      .from("meal_plan_items")
      .select("id,day_of_week,slot,description,recipe_id,position")
      .eq("plan_id", plan.id)
      .order("position");
    setItems((it.data ?? []) as unknown as PlanItem[]);
    const lg = await supabase
      .from("meal_logs")
      .select("item_id,completed")
      .eq("client_id", clientId)
      .eq("log_date", todayKey);
    const map: Record<string, boolean> = {};
    ((lg.data ?? []) as unknown as { item_id: string; completed: boolean }[]).forEach((l) => {
      map[l.item_id] = l.completed;
    });
    setDone(map);
    setLoaded(true);
  }, [clientId, todayKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(id: string) {
    const next = !done[id];
    setDone((d) => ({ ...d, [id]: next }));
    setError(null);
    const { error: err } = await supabase
      .from("meal_logs")
      .upsert(
        { client_id: clientId, item_id: id, log_date: todayKey, completed: next },
        { onConflict: "item_id,log_date" },
      );
    if (err) {
      setDone((d) => ({ ...d, [id]: !next }));
      setError(friendly(err.message));
    }
  }

  if (!loaded || !name) {
    return loaded ? (
      <Card title="Tu plan">
        <p className="text-sm text-ink/60">Tu dietista aún no te ha asignado un plan.</p>
      </Card>
    ) : null;
  }

  const isToday = day === todayDow;
  const dayItems = items.filter((i) => i.day_of_week === day);
  const todayItems = items.filter((i) => i.day_of_week === todayDow);
  const todayDone = todayItems.filter((i) => done[i.id]).length;

  return (
    <Card title={`Tu plan · ${name}`}>
      <div className="space-y-3">
        {todayItems.length > 0 && (
          <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand">
            Hoy llevas {todayDone} de {todayItems.length} comidas
          </p>
        )}
        <div className="flex gap-1">
          {DAYS.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(i + 1)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold ${
                day === i + 1 ? "bg-brand text-white" : i + 1 === todayDow ? "bg-brand-soft text-brand ring-1 ring-brand/40" : "bg-brand-soft text-brand"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink/50">
          {DAYS_LONG[day - 1]}
          {isToday ? " (hoy)" : " · solo puedes marcar las comidas del día de hoy"}
        </p>

        {dayItems.length === 0 ? (
          <p className="text-sm text-ink/50">Sin comidas planificadas este día.</p>
        ) : (
          SLOTS.map((s) => {
            const list = dayItems.filter((i) => i.slot === s.key);
            if (list.length === 0) return null;
            return (
              <div key={s.key}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand/70">{s.label}</h3>
                <ul className="space-y-1.5">
                  {list.map((i) => (
                    <li key={i.id}>
                      <label
                        className={`flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm ring-1 ring-black/5 ${
                          isToday ? "cursor-pointer" : "opacity-80"
                        } ${isToday && done[i.id] ? "bg-brand-soft" : "bg-white"}`}
                      >
                        <input
                          type="checkbox"
                          disabled={!isToday}
                          checked={isToday && !!done[i.id]}
                          onChange={() => void toggle(i.id)}
                          className="mt-0.5 h-5 w-5 accent-[#2c5036]"
                        />
                        <span className={isToday && done[i.id] ? "text-ink/50 line-through" : ""}>{i.description}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Card>
  );
}
