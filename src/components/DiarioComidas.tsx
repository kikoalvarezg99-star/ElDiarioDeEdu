"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, btnGhost } from "./ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { fmtDate, todayISO } from "@/lib/format";
import { uploadPhoto, useSignedUrls } from "@/lib/images";

const SLOTS = [
  { key: "breakfast", label: "Desayuno" },
  { key: "mid_morning", label: "Media mañana" },
  { key: "lunch", label: "Comida" },
  { key: "snack", label: "Merienda" },
  { key: "dinner", label: "Cena" },
] as const;

type FoodPhoto = {
  id: string;
  slot: string;
  storage_path: string;
  thumb_path: string | null;
  created_at: string;
  created_by: string | null;
};

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Diario de comidas: una foto por comida y por día. */
export default function DiarioComidas({
  clientId,
  clinicId,
  canUpload,
}: {
  clientId: string;
  clinicId: string;
  canUpload: boolean;
}) {
  const { session } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [items, setItems] = useState<FoodPhoto[]>([]);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [big, setBig] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("food_photos")
      .select("id,slot,storage_path,thumb_path,created_at,created_by")
      .eq("client_id", clientId)
      .eq("log_date", date)
      .order("created_at", { ascending: true });
    setItems((data ?? []) as unknown as FoodPhoto[]);
  }, [clientId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const paths = items.map((i) => i.thumb_path ?? i.storage_path);
  const urls = useSignedUrls(big ? [...paths, big] : paths);

  async function onFile(slot: string, file: File) {
    setBusySlot(slot);
    setError(null);
    try {
      const up = await uploadPhoto(file, clinicId, clientId, "food");
      const { error: err } = await supabase.from("food_photos").insert({
        client_id: clientId,
        log_date: date,
        slot,
        storage_path: up.path,
        thumb_path: up.thumbPath,
        size_bytes: up.size,
      });
      if (err) {
        await supabase.storage.from("photos").remove([up.path, up.thumbPath]);
        throw new Error(err.message);
      }
      await load();
    } catch (e) {
      setError(friendly(e instanceof Error ? e.message : "No se ha podido subir la foto"));
    }
    setBusySlot(null);
  }

  async function remove(p: FoodPhoto) {
    if (!window.confirm("¿Borrar esta foto?")) return;
    const { error: err } = await supabase.from("food_photos").delete().eq("id", p.id);
    if (err) {
      setError(friendly(err.message));
      return;
    }
    const files = [p.storage_path, ...(p.thumb_path ? [p.thumb_path] : [])];
    await supabase.storage.from("photos").remove(files);
    await load();
  }

  const isToday = date >= todayISO();

  return (
    <Card title="Diario de comidas">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setDate((d) => addDays(d, -1))}
          className={`${btnGhost} !px-3`}
          aria-label="Día anterior"
        >
          ←
        </button>
        <div className="text-center">
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-lg border border-black/10 bg-white px-2 py-1 text-sm"
          />
          <p className="mt-0.5 text-xs text-ink/50">
            {date === todayISO() ? "Hoy" : fmtDate(date)}
          </p>
        </div>
        <button
          type="button"
          disabled={isToday}
          onClick={() => setDate((d) => addDays(d, 1))}
          className={`${btnGhost} !px-3`}
          aria-label="Día siguiente"
        >
          →
        </button>
      </div>

      <div className="space-y-3">
        {SLOTS.map((s) => {
          const mine = items.filter((i) => i.slot === s.key);
          const busy = busySlot === s.key;
          return (
            <div key={s.key} className="rounded-xl p-3 ring-1 ring-black/10">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{s.label}</h3>
                {canUpload && (
                  <label
                    className={`${btnGhost} cursor-pointer !py-1.5 text-xs ${busy ? "opacity-50" : ""}`}
                  >
                    {busy ? "Subiendo…" : "＋ Añadir foto"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void onFile(s.key, f);
                      }}
                    />
                  </label>
                )}
              </div>

              {mine.length === 0 ? (
                <p className="text-xs text-ink/40">Sin foto</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {mine.map((p) => {
                    const url = urls[p.thumb_path ?? p.storage_path];
                    const own = canUpload && p.created_by === session?.user.id;
                    return (
                      <div key={p.id} className="relative">
                        <button
                          type="button"
                          onClick={() => setBig(p.storage_path)}
                          className="block h-24 w-24 overflow-hidden rounded-lg bg-brand-soft"
                        >
                          {url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={url}
                              alt={`${s.label} del ${fmtDate(date)}`}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </button>
                        {own && (
                          <button
                            type="button"
                            onClick={() => void remove(p)}
                            className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs text-red-600 shadow ring-1 ring-black/10"
                            aria-label="Borrar foto"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

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
