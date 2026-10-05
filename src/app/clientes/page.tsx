"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { Card, Field, Initials, btn, btnGhost, inputCls } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { fmtDate, fullName } from "@/lib/format";

type ClientRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  status: string;
  user_id: string | null;
  last_activity_at: string | null;
};

const STATUS: Record<string, string> = {
  active: "Activo",
  paused: "En pausa",
  archived: "Archivado",
};

function ClientesContent() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("clients")
      .select("id,first_name,last_name,email,status,user_id,last_activity_at")
      .order("first_name", { ascending: true });
    setClients((data ?? []) as unknown as ClientRow[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("clients")
      .insert({
        first_name: first.trim(),
        last_name: last.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
      })
      .select("id")
      .single();
    if (err || !data) {
      setError(friendly(err?.message ?? "No se pudo crear el cliente"));
      setBusy(false);
      return;
    }
    const newId = (data as { id: string }).id;
    // Se genera el código de invitación al momento (si falla, se puede crear
    // después desde la ficha).
    await supabase.from("client_invites").insert({ client_id: newId });
    router.push(`/cliente/?id=${newId}`);
  }

  const q = query.trim().toLowerCase();
  const filtered = clients.filter(
    (c) =>
      !q ||
      fullName(c).toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand">Clientes</h1>
        <button onClick={() => setAdding((v) => !v)} className={adding ? btnGhost : btn}>
          {adding ? "Cancelar" : "Nuevo cliente"}
        </button>
      </div>

      {adding && (
        <Card title="Nuevo cliente">
          <form onSubmit={create} className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre">
              <input required value={first} onChange={(e) => setFirst(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Apellidos">
              <input value={last} onChange={(e) => setLast(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Correo (opcional)">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Teléfono (opcional)">
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </Field>
            {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}
            <div className="md:col-span-2">
              <button disabled={busy} className={btn}>
                {busy ? "Creando…" : "Crear ficha"}
              </button>
            </div>
          </form>
        </Card>
      )}

      <input
        type="search"
        placeholder="Buscar por nombre o correo…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={inputCls}
      />

      <Card>
        {!loaded ? (
          <p className="text-sm text-ink/50">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-ink/50">
            {clients.length === 0
              ? "Todavía no hay clientes. Pulsa «Nuevo cliente» para crear el primero."
              : "Ningún cliente coincide con la búsqueda."}
          </p>
        ) : (
          <ul className="divide-y divide-black/5">
            {filtered.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cliente/?id=${c.id}`}
                  className="flex items-center gap-3 py-3 hover:opacity-80"
                >
                  <Initials name={fullName(c)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{fullName(c)}</p>
                    <p className="truncate text-xs text-ink/50">
                      {c.user_id
                        ? `Última actividad: ${fmtDate(c.last_activity_at)}`
                        : "Pendiente de alta"}
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
                    {STATUS[c.status] ?? c.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function ClientesPage() {
  return (
    <Shell area="staff">
      <ClientesContent />
    </Shell>
  );
}
