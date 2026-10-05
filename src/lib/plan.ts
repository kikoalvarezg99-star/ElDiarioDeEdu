export const SLOTS = [
  { key: "breakfast", label: "Desayuno" },
  { key: "mid_morning", label: "Media mañana" },
  { key: "lunch", label: "Comida" },
  { key: "snack", label: "Merienda" },
  { key: "dinner", label: "Cena" },
] as const;

export const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
export const DAYS_LONG = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

/** Día de la semana de una fecha local (1 = lunes … 7 = domingo). */
export function dow(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

/** Fecha local AAAA-MM-DD de un Date. */
export function iso(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export type PlanItem = {
  id: string;
  day_of_week: number;
  slot: string;
  description: string;
  recipe_id: string | null;
  position: number;
};
