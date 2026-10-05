"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Card, Field, btn, inputCls } from "./ui";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { fmtDate } from "@/lib/format";

const CATS = [
  { key: "dieta", label: "Dieta / plan" },
  { key: "analitica", label: "Analítica" },
  { key: "informe", label: "Informe" },
  { key: "otros", label: "Otros" },
] as const;
const catLabel = (k: string) => CATS.find((c) => c.key === k)?.label ?? k;

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

type Doc = {
  id: string;
  category: string;
  name: string;
  storage_path: string;
  size_bytes: number | null;
  created_at: string;
};

const fmtSize = (n: number | null) =>
  n == null ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/** Documentos privados: el personal sube, el cliente descarga. */
export default function Documentos({
  clientId,
  clinicId,
  canUpload,
}: {
  clientId: string;
  clinicId: string;
  canUpload: boolean;
}) {
  const [items, setItems] = useState<Doc[]>([]);
  const [category, setCategory] = useState("dieta");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select("id,category,name,storage_path,size_bytes,created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as unknown as Doc[]);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const ext = EXT[file.type];
    if (!ext) {
      setError("Formato no permitido. Usa PDF, Word, Excel o imagen (JPG/PNG).");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("El archivo supera los 20 MB.");
      return;
    }
    setBusy(true);
    setError(null);
    // Nombre en el almacenamiento aleatorio: nunca el del usuario.
    const path = `${clinicId}/${clientId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage
      .from("documents")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) {
      setError(friendly(up.error.message));
      setBusy(false);
      return;
    }
    const { error: err } = await supabase.from("documents").insert({
      client_id: clientId,
      category,
      name: name.trim() || file.name,
      storage_path: path,
      size_bytes: file.size,
    });
    if (err) {
      await supabase.storage.from("documents").remove([path]);
      setError(friendly(err.message));
    } else {
      setFile(null);
      setName("");
      (e.target as HTMLFormElement).reset();
      await load();
    }
    setBusy(false);
  }

  async function open(d: Doc) {
    const { data, error: err } = await supabase.storage
      .from("documents")
      .createSignedUrl(d.storage_path, 120, { download: false });
    if (err || !data) {
      setError(friendly(err?.message ?? "No se ha podido abrir el documento"));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remove(d: Doc) {
    if (!window.confirm(`¿Borrar «${d.name}»?`)) return;
    const { error: err } = await supabase.from("documents").delete().eq("id", d.id);
    if (err) {
      setError(friendly(err.message));
      return;
    }
    await supabase.storage.from("documents").remove([d.storage_path]);
    await load();
  }

  return (
    <Card title="Documentos">
      <div className="space-y-4">
        {canUpload && (
          <form onSubmit={upload} className="grid gap-3 rounded-xl bg-brand-soft/50 p-4 sm:grid-cols-2">
            <Field label="Tipo">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                {CATS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nombre (opcional)">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Dieta octubre" />
            </Field>
            <Field label="Archivo (PDF, Word, Excel, imagen · máx. 20 MB)">
              <input
                type="file"
                required
                accept=".pdf,.doc,.docx,.xlsx,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
              />
            </Field>
            <div className="flex items-end">
              <button disabled={busy || !file} className={`${btn} w-full`}>
                {busy ? "Subiendo…" : "Subir documento"}
              </button>
            </div>
          </form>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {items.length === 0 ? (
          <p className="text-sm text-ink/50">Todavía no hay documentos.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {items.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{d.name}</p>
                  <p className="text-xs text-ink/50">
                    {catLabel(d.category)} · {fmtDate(d.created_at)} {fmtSize(d.size_bytes) && `· ${fmtSize(d.size_bytes)}`}
                  </p>
                </div>
                <button type="button" onClick={() => void open(d)} className="text-sm font-semibold text-brand underline">
                  Abrir
                </button>
                {canUpload && (
                  <button type="button" onClick={() => void remove(d)} className="text-xs text-red-600 underline">
                    Borrar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
