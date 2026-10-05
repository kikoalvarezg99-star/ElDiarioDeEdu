export function fmtDate(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Fecha de hoy según la hora local del dispositivo (AAAA-MM-DD). */
export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function daysAgoISO(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

export function fullName(c: { first_name: string; last_name?: string | null }) {
  return `${c.first_name} ${c.last_name ?? ""}`.trim();
}
