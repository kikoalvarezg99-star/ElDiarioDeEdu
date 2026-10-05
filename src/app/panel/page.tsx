"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { Card, Initials, Stat } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { daysAgoISO, fmtDate, fullName, todayISO } from "@/lib/format";

type ClientRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  status: string;
  joined_on: string;
  last_activity_at: string | null;
  user_id: string | null;
};
type WeightRow = { value: number; measured_on: string; client_id: string };
type Req = { id: string; kind: string; client_id: string; created_at: string };
type ReviewRow = { client_id: string; next_review_on: string };

function PanelContent() {
  const { profile, session } = useAuth();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [photos, setPhotos] = useState(0);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    let active = true;
    (async () => {
      const [c, w, r, m, p] = await Promise.all([
        supabase
          .from("clients")
          .select("id,first_name,last_name,status,joined_on,last_activity_at,user_id")
          .order("created_at", { ascending: false }),
        supabase
          .from("measurements")
          .select("value,measured_on,client_id,measurement_types!inner(code)")
          .eq("measurement_types.code", "weight")
          .order("measured_on", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("reviews")
          .select("client_id,next_review_on")
          .gte("next_review_on", todayISO())
          .order("next_review_on", { ascending: true })
          .limit(6),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .neq("sender_id", uid)
          .is("read_at", null),
        supabase
          .from("photos")
          .select("id", { count: "exact", head: true })
          .gte("created_at", daysAgoISO(7)),
      ]);
      if (!active) return;
      setClients((c.data ?? []) as unknown as ClientRow[]);
      setWeights((w.data ?? []) as unknown as WeightRow[]);
      setReviews((r.data ?? []) as unknown as ReviewRow[]);
      const dr = await supabase
        .from("data_requests")
        .select("id,kind,client_id,created_at")
        .eq("status", "pending")
        .order("created_at");
      if (!active) return;
      setReqs((dr.data ?? []) as unknown as Req[]);
      setUnread(m.count ?? 0);
      setPhotos(p.count ?? 0);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [session]);

  const byId = new Map(clients.map((c) => [c.id, c]));
  const nameOf = (id: string) => {
    const c = byId.get(id);
    return c ? fullName(c) : "Cliente";
  };

  const active = clients.filter((c) => c.status === "active");
  const newOnes = clients.filter(
    (c) => Date.now() - new Date(c.joined_on).getTime() < 30 * 86_400_000,
  );
  const pending = clients.filter((c) => !c.user_id);
  const stale = active.filter(
    (c) =>
      c.user_id &&
      (!c.last_activity_at ||
        Date.now() - new Date(c.last_activity_at).getTime() > 7 * 86_400_000),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand">
          Hola, {profile?.first_name || "dietista"}
        </h1>
        <p className="text-sm text-ink/60">Resumen de tu consulta</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Clientes activos" value={ready ? active.length : "…"} />
        <Stat label="Nuevos (30 días)" value={ready ? newOnes.length : "…"} />
        <Stat
          label="Sin actividad"
          value={ready ? stale.length : "…"}
          hint="más de 7 días"
        />
        <Stat
          label="Pendientes de alta"
          value={ready ? pending.length : "…"}
          hint="aún sin cuenta"
        />
        <Stat label="Mensajes sin leer" value={ready ? unread : "…"} />
        <Stat label="Fotos nuevas" value={ready ? photos : "…"} hint="últimos 7 días" />
      </div>

      {reqs.length > 0 && (
        <Card title="Solicitudes de clientes (RGPD)">
          <ul className="divide-y divide-black/5">
            {reqs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <Link href={`/cliente/?id=${r.client_id}`} className="font-medium hover:underline">
                    {nameOf(r.client_id)}
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
          <p className="mt-2 text-xs text-ink/50">
            Para borrar: abre la ficha del cliente → «Borrar cliente y todos sus datos» (solo administrador).
          </p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Últimos pesos">
          {weights.length === 0 ? (
            <p className="text-sm text-ink/50">Todavía no hay pesos registrados.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {weights.map((w, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <Link
                    href={`/cliente/?id=${w.client_id}`}
                    className="font-medium hover:underline"
                  >
                    {nameOf(w.client_id)}
                  </Link>
                  <span className="text-ink/70">
                    <strong className="text-brand">{w.value} kg</strong> ·{" "}
                    {fmtDate(w.measured_on)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Próximas revisiones">
          {reviews.length === 0 ? (
            <p className="text-sm text-ink/50">No hay revisiones programadas.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {reviews.map((r, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <Link
                    href={`/cliente/?id=${r.client_id}`}
                    className="font-medium hover:underline"
                  >
                    {nameOf(r.client_id)}
                  </Link>
                  <span className="text-ink/70">{fmtDate(r.next_review_on)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Clientes sin actividad" className="md:col-span-2">
          {stale.length === 0 ? (
            <p className="text-sm text-ink/50">Todos tus clientes están al día.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {stale.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/cliente/?id=${c.id}`}
                    className="flex items-center gap-3 py-2.5 hover:opacity-80"
                  >
                    <Initials name={fullName(c)} />
                    <span className="flex-1 text-sm font-medium">{fullName(c)}</span>
                    <span className="text-xs text-ink/50">
                      Última actividad: {fmtDate(c.last_activity_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {ready && clients.length === 0 && (
        <Card>
          <p className="text-sm">
            Aún no tienes clientes.{" "}
            <Link href="/clientes/" className="font-semibold text-brand underline">
              Añade el primero
            </Link>
            .
          </p>
        </Card>
      )}
    </div>
  );
}

export default function PanelPage() {
  return (
    <Shell area="staff">
      <PanelContent />
    </Shell>
  );
}
