"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Shell from "@/components/Shell";
import RecetaVista, { RECIPE_SELECT, type RecipeFull } from "@/components/RecetaVista";
import { Card, Field, btn, btnGhost, inputCls } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { num } from "@/lib/numbers";

type Cat = { id: string; name: string };
type Ing = { name: string; quantity: string; unit: string };
type Form = {
  id: string | null;
  name: string;
  category_id: string;
  instructions: string;
  kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  ings: Ing[];
};

const emptyIng = (): Ing => ({ name: "", quantity: "", unit: "" });
const emptyForm = (): Form => ({
  id: null,
  name: "",
  category_id: "",
  instructions: "",
  kcal: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
  ings: [emptyIng()],
});

const optNum = (s: string) => (s.trim() === "" ? null : num(s));

function RecetasContent() {
  const [recipes, setRecipes] = useState<RecipeFull[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, c] = await Promise.all([
      supabase.from("recipes").select(RECIPE_SELECT).order("name"),
      supabase.from("recipe_categories").select("id,name").order("name"),
    ]);
    setRecipes((r.data ?? []) as unknown as RecipeFull[]);
    setCats((c.data ?? []) as unknown as Cat[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  function edit(r: RecipeFull) {
    setError(null);
    setForm({
      id: r.id,
      name: r.name,
      category_id: r.category_id ?? "",
      instructions: r.instructions ?? "",
      kcal: r.kcal?.toString() ?? "",
      protein_g: r.protein_g?.toString() ?? "",
      carbs_g: r.carbs_g?.toString() ?? "",
      fat_g: r.fat_g?.toString() ?? "",
      ings: r.recipe_ingredients.length
        ? r.recipe_ingredients.map((i) => ({
            name: i.name,
            quantity: i.quantity?.toString() ?? "",
            unit: i.unit ?? "",
          }))
        : [emptyIng()],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function addCat() {
    const name = newCat.trim();
    if (!name) return;
    const { data, error: err } = await supabase
      .from("recipe_categories")
      .insert({ name })
      .select("id")
      .single();
    if (err) {
      setError(friendly(err.message));
      return;
    }
    setNewCat("");
    await load();
    if (data) set("category_id", (data as { id: string }).id);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const nums = [form.kcal, form.protein_g, form.carbs_g, form.fat_g].map(optNum);
    if (nums.some((n) => n !== null && (Number.isNaN(n) || n < 0))) {
      setError("Los valores nutricionales deben ser números positivos.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      name: form.name.trim(),
      category_id: form.category_id || null,
      instructions: form.instructions.trim() || null,
      kcal: nums[0],
      protein_g: nums[1],
      carbs_g: nums[2],
      fat_g: nums[3],
    };
    let id = form.id;
    if (id) {
      const { error: err } = await supabase.from("recipes").update(body).eq("id", id);
      if (err) {
        setError(friendly(err.message));
        setBusy(false);
        return;
      }
      await supabase.from("recipe_ingredients").delete().eq("recipe_id", id);
    } else {
      const { data, error: err } = await supabase.from("recipes").insert(body).select("id").single();
      if (err || !data) {
        setError(friendly(err?.message ?? "No se ha podido guardar"));
        setBusy(false);
        return;
      }
      id = (data as { id: string }).id;
    }
    const rows = form.ings
      .filter((i) => i.name.trim())
      .map((i) => ({
        recipe_id: id,
        name: i.name.trim(),
        quantity: optNum(i.quantity),
        unit: i.unit.trim() || null,
      }));
    if (rows.length) {
      const { error: err } = await supabase.from("recipe_ingredients").insert(rows);
      if (err) setError(friendly(err.message));
    }
    setForm(null);
    await load();
    setBusy(false);
  }

  async function remove(r: RecipeFull) {
    if (!window.confirm(`¿Borrar la receta «${r.name}»? Se quitará también a los clientes que la tengan asignada.`)) return;
    const { error: err } = await supabase.from("recipes").delete().eq("id", r.id);
    if (err) setError(friendly(err.message));
    await load();
  }

  const shown = filter ? recipes.filter((r) => r.category_id === filter) : recipes;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand">Recetas</h1>
          <p className="text-sm text-ink/60">Tu recetario. Después las asignas a cada cliente desde su ficha.</p>
        </div>
        {!form && (
          <button
            type="button"
            className={btn}
            onClick={() => {
              setError(null);
              setForm(emptyForm());
            }}
          >
            Nueva receta
          </button>
        )}
      </div>

      {form && (
        <Card title={form.id ? "Editar receta" : "Nueva receta"}>
          <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre">
              <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Categoría">
              <select value={form.category_id} onChange={(e) => set("category_id", e.target.value)} className={inputCls}>
                <option value="">Sin categoría</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex gap-2 md:col-span-2">
              <input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="Crear categoría nueva…"
                className={inputCls}
              />
              <button type="button" onClick={() => void addCat()} className={btnGhost}>
                Crear
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:col-span-2 md:grid-cols-4">
              <Field label="Kcal">
                <input inputMode="decimal" value={form.kcal} onChange={(e) => set("kcal", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Proteína (g)">
                <input inputMode="decimal" value={form.protein_g} onChange={(e) => set("protein_g", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Hidratos (g)">
                <input inputMode="decimal" value={form.carbs_g} onChange={(e) => set("carbs_g", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Grasa (g)">
                <input inputMode="decimal" value={form.fat_g} onChange={(e) => set("fat_g", e.target.value)} className={inputCls} />
              </Field>
            </div>

            <div className="md:col-span-2">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-brand/70">Ingredientes</p>
              <div className="space-y-2">
                {form.ings.map((i, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_5rem_5rem_auto] gap-2">
                    <input
                      value={i.name}
                      onChange={(e) => set("ings", form.ings.map((x, k) => (k === idx ? { ...x, name: e.target.value } : x)))}
                      placeholder="Ingrediente"
                      className={inputCls}
                    />
                    <input
                      inputMode="decimal"
                      value={i.quantity}
                      onChange={(e) => set("ings", form.ings.map((x, k) => (k === idx ? { ...x, quantity: e.target.value } : x)))}
                      placeholder="Cant."
                      className={inputCls}
                    />
                    <input
                      value={i.unit}
                      onChange={(e) => set("ings", form.ings.map((x, k) => (k === idx ? { ...x, unit: e.target.value } : x)))}
                      placeholder="g, ud…"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      aria-label="Quitar ingrediente"
                      onClick={() => set("ings", form.ings.length > 1 ? form.ings.filter((_, k) => k !== idx) : [emptyIng()])}
                      className="px-2 text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => set("ings", [...form.ings, emptyIng()])} className="mt-2 text-xs font-semibold text-brand underline">
                + Añadir ingrediente
              </button>
            </div>

            <div className="md:col-span-2">
              <Field label="Preparación">
                <textarea rows={5} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} className={inputCls} />
              </Field>
            </div>
            {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}
            <div className="flex gap-2 md:col-span-2">
              <button disabled={busy} className={btn}>
                {busy ? "Guardando…" : "Guardar receta"}
              </button>
              <button type="button" onClick={() => setForm(null)} className={btnGhost}>
                Cancelar
              </button>
            </div>
          </form>
        </Card>
      )}
      {!form && error && <p className="text-sm text-red-600">{error}</p>}

      {cats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[{ id: "", name: "Todas" }, ...cats].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                filter === c.id ? "bg-brand text-white" : "bg-brand-soft text-brand"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <Card>
          <p className="text-sm text-ink/60">Todavía no hay recetas.</p>
        </Card>
      ) : (
        shown.map((r) => (
          <Card key={r.id}>
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="flex-1 text-left">
                <span className="block font-semibold text-brand">{r.name}</span>
                {r.recipe_categories && <span className="text-xs text-ink/50">{r.recipe_categories.name}</span>}
              </button>
              <button type="button" onClick={() => edit(r)} className="text-xs font-semibold text-brand underline">
                Editar
              </button>
              <button type="button" onClick={() => void remove(r)} className="text-xs text-red-600 underline">
                Borrar
              </button>
            </div>
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

export default function RecetasPage() {
  return (
    <Shell area="staff">
      <RecetasContent />
    </Shell>
  );
}
