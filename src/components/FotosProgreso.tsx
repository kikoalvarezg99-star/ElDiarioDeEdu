"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Card, Field, btn, inputCls } from "./ui";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { fmtDate, todayISO } from "@/lib/format";
import { uploadPhoto, useSignedUrls } from "@/lib/images";

const KINDS = [
  { key: "front", label: "Frontal" },
  { key: "side", label: "Lateral" },
  { key: "back", label: "Trasera" },
  { key: "other", label: "Otra" },
] as const;

const kindLabel = (k: string) => KINDS.find((x) => x.key === k)?.label ?? k;

type Photo = {
  id: string;
  kind: string;
  taken_on: string;
  storage_path: string;
  thumb_path: string | null;
};

/** Fotos de progreso (frontal, lateral, trasera…) con galería y comparador. */
export default function FotosProgreso({
  clientId,
  clinicId,
  canUpload,
  canDelete,
}: {
  clientId: string;
  clinicId: string;
  canUpload: boolean;
  canDelete: boolean;
}) {
  const [items, setItems] = useState<Photo[]>([]);
  const [kind, setKind] = useState<string>("front");
  const [date, setDate] = useState(todayISO());
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [big, setBig] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("photos")
      .select("id,kind,taken_on,storage_path,thumb_path")
      .eq("client_id", clientId)
      .order("taken_on", { ascending: false })
      .order("created_at", { ascending: false });
    setItems((data ?? []) as unknown as Photo[]);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const compare = selected
    .map((id) => items.find((i) => i.id === id))
    .filter((p): p is Photo => !!p);

  const wanted = [
    ...items.map((i) => i.thumb_path ?? i.storage_path),
    ...compare.map((p) => p.storage_path),
    ...(big ? [big] : []),
  ];
  const urls = useSignedUrls(wanted);

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const up = await uploadPhoto(file, clinicId, clientId, "progress");
      const { error: err } = await supabase.from("photos").insert({
        client_id: clientId,
        kind,
        taken_on: date,
        storage_path: up.path,
        thumb_path: up.thumbPath,
        size_bytes: up.size,
      });
      if (err) {
        await supabase.storage.from("photos").remove([up.path, up.thumbPath]);
        throw new Error(err.message);
      }
      setFile(null);
      await load();
    } catch (e2) {
      setError(friendly(e2 instanceof Error ? e2.message : "No se ha podido subir la foto"));
    }
    setBusy(false);
  }

  async function remove(p: Photo) {
    if (!window.confirm("¿Borrar esta foto?")) return;
    const { error: err } = await supabase.from("photos").delete().eq("id", p.id);
    if (err) {
      setError(friendly(err.message));
      return;
    }
    await supabase.storage
      .from("photos")
      .remove([p.storage_path, ...(p.thumb_path ? [p.thumb_path] : [])]);
    setSelected((s) => s.filter((x) => x !== p.id));
    await load();
  }

  function toggle(id: string) {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s.slice(-1), id],
    );
  }

  // Agrupadas por fecha
  const groups: { date: string; photos: Photo[] }[] = [];
  items.forEach((p) => {
    const g = groups.find((x) => x.date === p.taken_on);
    if (g) g.photos.push(p);
    else groups.push({ date: p.taken_on, photos: [p] });
  });

  return (
    <Card title="Fotos de progreso">
      <div className="space-y-4">
        {canUpload && (
          <form onSubmit={upload} className="grid gap-3 rounded-xl bg-brand-soft/50 p-4 sm:grid-cols-4">
            <Field label="Tipo">
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
                {KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fecha">
              <input type="date" required max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Foto">
              <input
                type="file"
                accept="image/*"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
              />
            </Field>
            <div className="flex items-end">
              <button disabled={busy || !file} className={`${btn} w-full`}>
                {busy ? "Subiendo…" : "Subir foto"}
              </button>
            </div>
          </form>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {compare.length === 2 && (
          <div className="rounded-xl p-3 ring-1 ring-brand/30">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand">Comparación</h3>
              <button type="button" onClick={() => setSelected([])} className="text-xs underline">
                Cerrar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {compare.map((p) => (
                <figure key={p.id}>
                  {urls[p.storage_path] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={urls[p.storage_path]} alt="" className="w-full rounded-lg" />
                  ) : (
                    <div className="aspect-[3/4] rounded-lg bg-brand-soft" />
                  )}
                  <figcaption className="mt-1 text-center text-xs text-ink/60">
                    {kindLabel(p.kind)} · {fmtDate(p.taken_on)}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-ink/50">Todavía no hay fotos de progreso.</p>
        ) : (
          <>
            <p className="text-xs text-ink/50">
              Marca dos fotos con la casilla para compararlas. Toca una foto para verla en grande.
            </p>
            {groups.map((g) => (
              <div key={g.date}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand/70">
                  {fmtDate(g.date)}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {g.photos.map((p) => {
                    const url = urls[p.thumb_path ?? p.storage_path];
                    return (
                      <div key={p.id} className="relative w-24">
                        <button
                          type="button"
                          onClick={() => setBig(p.storage_path)}
                          className="block h-32 w-24 overflow-hidden rounded-lg bg-brand-soft"
                        >
                          {url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt={kindLabel(p.kind)} className="h-full w-full object-cover" />
                          )}
                        </button>
                        <input
                          type="checkbox"
                          checked={selected.includes(p.id)}
                          onChange={() => toggle(p.id)}
                          className="absolute left-1.5 top-1.5 h-4 w-4 accent-[#2c5036]"
                          aria-label="Seleccionar para comparar"
                        />
                        <p className="mt-0.5 text-center text-xs text-ink/60">{kindLabel(p.kind)}</p>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void remove(p)}
                            className="block w-full text-center text-xs text-red-600 underline"
                          >
                            Borrar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {big && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setBig(null)}
        >
          {urls[big] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls[big]} alt="Foto ampliada" className="max-h-full max-w-full rounded-lg" />
          ) : (
            <p className="text-sm text-white">Cargando…</p>
          )}
        </div>
      )}
    </Card>
  );
}
