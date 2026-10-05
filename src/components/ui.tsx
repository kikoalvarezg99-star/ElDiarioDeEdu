import type { ReactNode } from "react";

/** Prefijo de la ruta cuando la web se publica en GitHub Pages. */
export const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const btn =
  "inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand ring-1 ring-black/10 transition hover:bg-brand-soft disabled:opacity-50";

export const inputCls =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 ${className}`}
    >
      {title && (
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand/70">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <p className="text-xs font-medium text-ink/60">{label}</p>
      <p className="mt-1 text-3xl font-bold text-brand">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink/50">{hint}</p>}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink/70">{label}</span>
      {children}
    </label>
  );
}

export function Initials({ name }: { name: string }) {
  const letters = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
      {letters || "?"}
    </span>
  );
}

export function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-brand text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${base}/logo-full.svg`}
        alt="Eduardo Rivero"
        className="w-40 rounded-2xl"
      />
      <p className="text-sm opacity-80">Cargando…</p>
    </div>
  );
}
