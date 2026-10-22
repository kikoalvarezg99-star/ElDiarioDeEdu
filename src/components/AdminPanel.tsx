"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Stat } from "./ui";
import { supabase } from "@/lib/supabase";
import { fmtDate } from "@/lib/format";
import { fmtNum } from "@/lib/numbers";
import { mb, type AdminUser } from "@/lib/admin";

type Stats = { files_bytes: number; db_bytes: number; messages_30d: number; requests_pending: number };
type Req = { id: string; kind: string; client_id: string; created_at: string };

const FILES_LIMIT_MB = 1024; // plan gratuito de Supabase
const DB_LIMIT_MB = 500;

function Bar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-ink/60">
          {fmtNum(used, 1)} MB de {limit} MB ({fmtNum(pct, 0)} %)
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-brand-soft">
        <div className={`h-full ${pct > 80 ? "bg-red-500" : "bg-brand"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Panel del administrador: usuarios, uso del sistema y solicitudes. */
export default function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingClients, setPendingClients] = useState(0);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [u, s, pc, dr, cl] = await Promise.all([
        supabase.rpc("admin_users"),
        supabase.rpc("admin_stats"),
        supabase.from("clients").select("id", { count: "exact", head: true }).is("user_id", null),
        supabase.from("data_requests").select("id,kind,client_id,created_at").eq("status", "pending").order("created_at"),
        supabase.from("clients").select("id,first_name,last_name"),
      ]);
      if (!active) return;
      if (u.error || s.error) {
        setError("Faltan las funciones del administrador en la base de datos. Ejecuta el SQL «actualizacion_admin».");
      }
      setUsers((u.data ?? []) as unknown as AdminUser[]);
      setStats((s.data ?? null) as unknown as Stats | null);
      setPendingClients(pc.count ?? 0);
      setReqs((dr.data ?? []) as unknown as Req[]);
      setNames(
        new Map(
          ((cl.data ?? []) as unknown as { id: string; first_name: string; last_name: string | null }[]).map((c) => [
            c.id,
            `${c.first_name} ${c.last_name ?? ""}`.trim(),
          ]),
        ),
      );
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const staff = users.filter((x) => x.role !== "client");
  const clients = users.filter((x) => x.role === "client");
  const week = Date.now() - 7 * 86_400_000;
  const activeWeek = clients.filter((c) => c.last_sign_in_at && new Date(c.last_sign_in_at).getTime() > week).length;
  const banned = users.filter((x) => x.banned).length;
  const v = (n: number) => (ready ? n : "…");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand">Administración</h1>
        <p className="text-sm text-ink/60">Control de usuarios y estado de la aplicación.</p>
      </div>

      {error && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Dietistas" value={v(staff.filter((s) => s.role === "dietitian").length)} />
        <Stat label="Clientes con cuenta" value={v(clients.length)} />
        <Stat label="Clientes sin cuenta" value={v(pendingClients)} hint="pendientes de alta" />
        <Stat label="Activos esta semana" value={v(activeWeek)} hint="han entrado" />
        <Stat label="Accesos suspendidos" value={v(banned)} />
        <Stat label="Mensajes (30 días)" value={stats ? stats.messages_30d : "…"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Uso de espacio (plan gratuito)">
          {stats ? (
            <div className="space-y-4">
              <Bar label="Fotos y documentos" used={mb(Number(stats.files_bytes))} limit={FILES_LIMIT_MB} />
              <Bar label="Base de datos" used={mb(Number(stats.db_bytes))} limit={DB_LIMIT_MB} />
              <p className="text-xs text-ink/50">
                Al acercarte al límite conviene pasar al plan Pro de Supabase o borrar fotos antiguas.
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink/50">Sin datos todavía.</p>
          )}
        </Card>

        <Card title="Accesos rápidos">
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/usuarios/" className="font-semibold text-brand underline">
                Gestionar usuarios
              </Link>{" "}
              · invitar, suspender o eliminar
            </li>
            <li>
              <Link href="/auditoria/" className="font-semibold text-brand underline">
                Registro de auditoría
              </Link>{" "}
              · quién hizo qué
            </li>
            <li>
              <Link href="/ajustes/" className="font-semibold text-brand underline">
                Ajustes
              </Link>{" "}
              · tu perfil
            </li>
          </ul>
        </Card>
      </div>

      <Card title={`Solicitudes de clientes sobre sus datos (${ready ? reqs.length : "…"})`}>
        {reqs.length === 0 ? (
          <p className="text-sm text-ink/50">No hay solicitudes pendientes.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {reqs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <Link href={`/cliente/?id=${r.client_id}`} className="font-medium hover:underline">
                    {names.get(r.client_id) ?? "Cliente"}
                  </Link>{" "}
                  pide <strong>{r.kind === "delete" ? "borrar su cuenta y datos" : "una copia de sus datos"}</strong>{" "}
                  <span className="text-xs text-ink/50">({fmtDate(r.created_at)})</span>
                </span>
                <button
                  type="button"
                  className="text-xs font-semibold text-brand underline"
                  onClick={async () => {
                    await supabase.from("data_requests").update({ status: "done" }).eq("id", r.id);
                    setReqs((x) => x.filter((y) => y.id !== r.id));
                  }}
                >
                  Marcar como atendida
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-ink/50">
          Para borrar a un cliente: Usuarios → su ficha → «Borrar cliente y todos sus datos».
        </p>
      </Card>
    </div>
  );
}
