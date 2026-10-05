"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import RecetaVista, { RECIPE_SELECT, type RecipeFull } from "@/components/RecetaVista";
import { Card } from "@/components/ui";
import { supabase } from "@/lib/supabase";

function Content() {
  const [items, setItems] = useState<RecipeFull[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Por RLS, el cliente solo recibe las recetas que se le han asignado.
    supabase
      .from("recipes")
      .select(RECIPE_SELECT)
      .order("name")
      .then(({ data }) => {
        if (!active) return;
        setItems((data ?? []) as unknown as RecipeFull[]);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand">Mis recetas</h1>
        <p className="text-sm text-ink/60">Las recetas que te ha asignado tu dietista.</p>
      </div>
      {!loaded ? (
        <p className="text-sm text-ink/50">Cargando…</p>
      ) : items.length === 0 ? (
        <Card>
          <p className="text-sm text-ink/60">Todavía no tienes recetas asignadas.</p>
        </Card>
      ) : (
        items.map((r) => (
          <Card key={r.id}>
            <button
              type="button"
              onClick={() => setOpen(open === r.id ? null : r.id)}
              className="flex w-full items-center justify-between text-left"
            >
              <span>
                <span className="block font-semibold text-brand">{r.name}</span>
                {r.recipe_categories && (
                  <span className="text-xs text-ink/50">{r.recipe_categories.name}</span>
                )}
              </span>
              <span className="text-brand">{open === r.id ? "−" : "+"}</span>
            </button>
            {open === r.id && (
              <div className="mt-3 border-t border-black/5 pt-3">
                <RecetaVista r={r} />
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

export default function MisRecetasPage() {
  return (
    <Shell area="client">
      <Content />
    </Shell>
  );
}
