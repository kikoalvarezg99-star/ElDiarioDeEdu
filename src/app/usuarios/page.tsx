"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { Card, btn, btnGhost, inputCls } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { fmtDate, fullName } from "@/lib/format";
import { useOwnerOnly, type AdminUser } from "@/lib/admin";

type ClientRow = { id: string; first_name: string; last_name: string | null; email: string | null; status: string; user_id: string | null };
type Invite = { code: string; expires_at: string };

const ROLE: Record<string, string> = { owner: "Administrador", dietitian: "Dietista" };

function Content() {
  const owner = useOwnerOnly();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [u, c, i] = await Promise.all([
      supabase.rpc("admin_users"),
      supabase.from("clients").select("id,first_name,last_name,email,status,user_id").order("created_at", { ascending: false }),
      supabase
        .from("staff_invites")
        .select("code,expires_at")
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
    ]);
    if (u.error) setError(friendly(u.error.message));
    setUsers((u.data ?? []) as unknown as AdminUser[]);
    setClients((c.data ?? []) as unknown as ClientRow[]);
    setInvites((i.data ?? []) as unknown as Invite[]);
  }, []);

  useEffect(() => {
    if (owner) void load();
  }, [owner, load]);

  async function ban(u: AdminUser, banned: boolean) {
    const nm = `${u.first_name} ${u.last_name}`.trim() || u.email || "este usuario";
    if (banned && !window.confirm(`¿Suspender el acceso de ${nm}? No podrá entrar hasta que lo reactives.`)) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("admin_set_banned", { p_user: u.user_id, p_banned: banned });
    if (err) setError(friendly(err.message));
    await load();
    setBusy(false);
  }

  async function removeStaff(u: AdminUser) {
    const nm = `${u.first_name} ${u.last_name}`.trim() || u.email || "este dietista";
    if (!window.confirm(`¿Eliminar a ${nm}? Su cuenta se borra para siempre (los clientes y sus datos no se tocan).`)) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("admin_remove_staff", { p_user: u.user_id });
    if (err) setError(friendly(err.message));
    await load();
    setBusy(false);
  }

  async function newInvite() {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("staff_invites").insert({});
    if (err) setError(friendly(err.message));
    await load();
    setBusy(false);
  }

  if (!owner) return null;

  const byClient = new Map(users.filter((u) => u.client_id).map((u) => [u.client_id as string, u]));
  const staff = users.filter((u) => u.role !== "client");
  const needle = q.trim().toLowerCase();
  const shownClients = clients.filter((c) => !needle || `${fullName(c)} ${c.email ?? ""}`.toLowerCase().includes(needle));
  const last = (d: string | null) => (d ? fmtDate(d) : "nunca");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand">Usuarios</h1>
        <p className="text-sm text-ink/60">Quién tiene acceso a la aplicación y control de cuentas.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card title="Equipo">
        <ul className="divide-y divide-black/5">
          {staff.map((u) => (
            <li key={u.user_id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {`${u.first_name} ${u.last_name}`.trim() || "Sin nombre"}{" "}
                  <span className="text-xs font-normal text-brand">{ROLE[u.role] ?? u.role}</span>
                  {u.banned && <span className="ml-2 rounded bg-red-100 px-1.5 text-xs text-red-700">suspendido</span>}
                </p>
                <p className="truncate text-xs text-ink/50">
                  {u.email} · último acceso: {last(u.last_sign_in_at)}
                </p>
              </div>
              {u.role === "dietitian" && (
                <div className="flex gap-3">
                  <button disabled={busy} onClick={() => void ban(u, !u.banned)} className="text-xs font-semibold text-brand underline">
                    {u.banned ? "Reactivar" : "Suspender"}
                  </button>
                  <button disabled={busy} onClick={() => void removeStaff(u)} className="text-xs text-red-600 underline">
                    Eliminar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-xl bg-brand-soft/50 p-4">
          <p className="mb-2 text-sm font-semibold text-brand">Invitar a un dietista</p>
          <p className="mb-3 text-xs text-ink/60">
            Genera un código y envíaselo. Se crea su cuenta en la app («Crear cuenta») e introduce el código. Caduca a los
            7 días y sirve una vez.
          </p>
          {invites.length > 0 && (
            <ul className="mb-3 space-y-2">
              {invites.map((i) => (
                <li key={i.code} className="flex flex-wrap items-center gap-3">
                  <code className="text-lg font-bold tracking-wider text-brand">{i.code}</code>
                  <span className="text-xs text-ink/60">caduca el {fmtDate(i.expires_at)}</span>
                  <button type="button" onClick={() => void navigator.clipboard?.writeText(i.code)} className={`${btnGhost} !py-1 text-xs`}>
                    Copiar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button disabled={busy} onClick={() => void newInvite()} className={btn}>
            Generar código nuevo
          </button>
        </div>
      </Card>

      <Card title={`Clientes (${clients.length})`}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o correo…" className={`${inputCls} mb-3`} />
        {shownClients.length === 0 ? (
          <p className="text-sm text-ink/50">Sin resultados.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {shownClients.map((c) => {
              const u = byClient.get(c.id);
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {fullName(c)}
                      {u?.banned && <span className="ml-2 rounded bg-red-100 px-1.5 text-xs font-normal text-red-700">suspendido</span>}
                      {c.status !== "active" && (
                        <span className="ml-2 rounded bg-black/5 px-1.5 text-xs font-normal text-ink/60">
                          {c.status === "paused" ? "en pausa" : "archivado"}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink/50">
                      {u ? `${u.email} · último acceso: ${last(u.last_sign_in_at)}` : "Todavía sin cuenta en la app"}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Link href={`/cliente/?id=${c.id}`} className="text-xs font-semibold text-brand underline">
                      Ficha
                    </Link>
                    {u && (
                      <button disabled={busy} onClick={() => void ban(u, !u.banned)} className="text-xs font-semibold text-brand underline">
                        {u.banned ? "Reactivar" : "Suspender"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink/50">
          Suspender impide entrar a la app (puede tardar hasta una hora en aplicarse si el usuario ya está dentro). Para
          borrar a un cliente y sus datos, abre su ficha.
        </p>
      </Card>
    </div>
  );
}

export default function UsuariosPage() {
  return (
    <Shell area="staff">
      <Content />
    </Shell>
  );
}
