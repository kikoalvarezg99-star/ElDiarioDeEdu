"use client";

import { fmtNum } from "@/lib/numbers";

export type RecipeFull = {
  id: string;
  name: string;
  category_id: string | null;
  instructions: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  recipe_categories: { name: string } | null;
  recipe_ingredients: { id: string; name: string; quantity: number | null; unit: string | null }[];
};

export const RECIPE_SELECT =
  "id,name,category_id,instructions,kcal,protein_g,carbs_g,fat_g,recipe_categories(name),recipe_ingredients(id,name,quantity,unit)";

/** Ficha de lectura de una receta. */
export default function RecetaVista({ r }: { r: RecipeFull }) {
  const macros = [
    r.kcal != null && `${fmtNum(Number(r.kcal), 0)} kcal`,
    r.protein_g != null && `${fmtNum(Number(r.protein_g), 1)} g proteína`,
    r.carbs_g != null && `${fmtNum(Number(r.carbs_g), 1)} g hidratos`,
    r.fat_g != null && `${fmtNum(Number(r.fat_g), 1)} g grasa`,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-3 text-sm">
      {macros.length > 0 && (
        <p className="rounded-xl bg-brand-soft px-3 py-2 text-xs font-medium text-brand">
          {macros.join(" · ")} <span className="text-brand/60">(por ración)</span>
        </p>
      )}
      {r.recipe_ingredients.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand/70">Ingredientes</h4>
          <ul className="list-disc space-y-0.5 pl-5">
            {r.recipe_ingredients.map((i) => (
              <li key={i.id}>
                {i.quantity != null && `${fmtNum(Number(i.quantity), 2)} `}
                {i.unit ? `${i.unit} de ` : ""}
                {i.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.instructions && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand/70">Preparación</h4>
          <p className="whitespace-pre-line">{r.instructions}</p>
        </div>
      )}
    </div>
  );
}
