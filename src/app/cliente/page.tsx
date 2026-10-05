"use client";

import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Shell from "@/components/Shell";
import { Card, Field, base, btn, btnGhost, inputCls } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { fmtDate, fullName } from "@/lib/format";
import Evolucion from "@/components/Evolucion";
import Revisiones from "@/components/Revisiones";

type Client = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  height_cm: number | null;
  goals: string | null;
  status: string;
  joined_on: string;
  user_id: string | null;
};
type Invite = { code: string; expires_at: string };
type Note = { id: string; body: string; created_at: string };

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  birth_date: "",
  height_cm: "",
  goals: "",
  status: "active",
};

function Ficha() {
  const params = useSearchParams();
  const id = params?.get("id") ?? null;

  const [client, setClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [evoKey, setEvoKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setLoaded(true);
      return;
    }
    const [c, inv, n] = await Promise.all([
      supabase.from("clients").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("client_invites")
        .select("code,expires_at")
        .eq("client_id", id)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("client_notes")
        .select("id,body,created_at")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
    ]);
    const row = (c.data as Client | null) ?? null;
    setClient(row);
    if (row) {
      setForm({
        first_name: row.first_name,
        last_name: row.last_name ?? "",
        email: row.email ?? "",
        phone: row.phone ?? "",
        birth_date: row.birth_date ?? "",
        height_cm: row.height_cm?.toString() ?? "",
        goals: row.goals ?? "",
        status: row.status,
      });
    }
    setInvites((inv.data ?? []) as unknown as Invite[]);
    setNotes((n.data ?? []) as unknown as Note[]);
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (k: keyof typeof emptyForm, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const height = form.height_cm.trim() === "" ? null : Number(form.height_cm.replace(",", "."));
    const { error: err } = await supabase
      .from("clients")
      .update({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        birth_date: form.birth_date || null,
        height_cm: height,
        goals: form.goals.trim() || null,
        status: form.status,
      })
      .eq("id", id);
    if (err) setError(friendly(err.message));
    else setMsg("Cambios guardados");
    setBusy(false);
  }

  async function createInvite() {
    if (!id) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("client_invites")
      .insert({ client_id: id });
    if (err) setError(friendly(err.message));
    await load();
    setBusy(false);
  }

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!id || !noteText.trim()) return;
    const { error: err } = await supabase
      .from("client_notes")
      .insert({ client_id: id, body: noteText.trim() });
    if (err) {
      setError(friendly(err.message));
      return;
    }
    setNoteText("");
    await load();
  }

  if (!id) {
    return <p className="text-sm">Falta indicar el cliente.</p>;
  }
  if (!loaded) return <p className="text-sm text-ink/50">Cargando…</p>;
  if (!client) {
    return (
      <Card>
        <p className="text-sm">
          No se ha encontrado este cliente o no tienes acceso a él.{" "}
          <Link href="/clientes/" className="font-semibold text-brand underline">
            Volver a clientes
          </Link>
        </p>
      </Card>
    );
  }

  const registerUrl =
    typeof window !== "undefined" ? `${window.location.origin}${base}/login/` : "";

  return (
    <div className="space-y-5">
      <div>
        <Link href="/clientes/" className="text-xs text-brand underline">
          ← Clientes
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-brand">{fullName(client)}</h1>
        <p className="text-sm text-ink/60">
          Alta: {fmtDate(client.joined_on)} ·{" "}
          {client.user_id ? "Con cuenta en la app" : "Pendiente de alta en la app"}
        </p>
      </div>

      <Card title="Información personal">
        <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
          <Field label="Nombre">
            <input required value={form.first_name} onChange={(e) => set("first_name", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Apellidos">
            <input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Correo">
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Teléfono">
            <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Fecha de nacimiento">
            <input type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Altura (cm)">
            <input inputMode="decimal" value={form.height_cm} onChange={(e) => set("height_cm", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Estado">
            <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
              <option value="active">Activo</option>
              <option value="paused">En pausa</option>
              <option value="archived">Archivado</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Objetivos">
              <textarea rows={3} value={form.goals} onChange={(e) => set("goals", e.target.value)} className={inputCls} />
            </Field>
          </div>
          {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}
          {msg && <p className="text-sm text-brand md:col-span-2">{msg}</p>}
          <div className="md:col-span-2">
            <button disabled={busy} className={btn}>
              {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </Card>

      {!client.user_id && (
        <Card title="Invitar al cliente a la app">
          <p className="mb-3 text-sm text-ink/70">
            Genera un código y envíaselo a tu cliente. Él entra en la app, pulsa
            «Crear cuenta», y en el siguiente paso introduce el código. El
            código caduca a los 7 días y solo sirve una vez.
          </p>
          {invites.length > 0 && (
            <ul className="mb-3 space-y-2">
              {invites.map((i) => (
                <li key={i.code} className="flex flex-wrap items-center gap-3 rounded-xl bg-brand-soft px-4 py-3">
                  <code className="text-lg font-bold tracking-wider text-brand">{i.code}</code>
                  <span className="text-xs text-ink/60">caduca el {fmtDate(i.expires_at)}</span>
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(i.code)}
                      className={`${btnGhost} !py-1.5 text-xs`}
                    >
                      Copiar código
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void navigator.clipboard?.writeText(
                          `Hola ${client.first_name}, ya tienes tu espacio en la app de Eduardo Rivero. Entra en ${registerUrl}, pulsa «Crear cuenta» y, cuando te lo pida, introduce este código de invitación: ${i.code}`,
                        )
                      }
                      className={`${btn} !py-1.5 text-xs`}
                    >
                      Copiar mensaje
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {registerUrl && (
            <p className="mb-3 break-all text-xs text-ink/60">
              Dirección para registrarse: <strong>{registerUrl}</strong>
            </p>
          )}
          <button type="button" onClick={() => void createInvite()} disabled={busy} className={btn}>
            Generar código nuevo
          </button>
        </Card>
      )}

      <Card title="Notas privadas">
        <p className="mb-3 text-xs text-ink/50">Solo las ves tú; el cliente no tiene acceso.</p>
        <form onSubmit={addNote} className="mb-4 flex gap-2">
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Escribe una nota…"
            className={inputCls}
          />
          <button className={btn}>Añadir</button>
        </form>
        {notes.length === 0 ? (
          <p className="text-sm text-ink/50">Sin notas todavía.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {notes.map((n) => (
              <li key={n.id} className="py-2.5">
                <p className="text-sm">{n.body}</p>
                <p className="text-xs text-ink/40">{fmtDate(n.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Evolucion
        key={evoKey}
        clientId={client.id}
        heightCm={client.height_cm}
        staff
      />

      <Revisiones
        clientId={client.id}
        onSaved={() => setEvoKey((k) => k + 1)}
      />

      <Card title="Próximamente en esta ficha">
        <p className="text-sm text-ink/60">
          Fotos, plan nutricional, recetas, mensajes y documentos se añadirán
          en las siguientes fases.
        </p>
      </Card>
    </div>
  );
}

export default function ClientePage() {
  return (
    <Shell area="staff">
      <Suspense fallback={<p className="text-sm text-ink/50">Cargando…</p>}>
        <Ficha />
      </Suspense>
    </Shell>
  );
}
