"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Card } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useOwnerOnly } from "@/lib/admin";

type Row = { id: number; actor_id: string | null; action: string; table_name: string | null; record_id: string | null; created_at: string };

const ACTION: Record<string, string> = {
  erase_client: "Borró a un cliente y todos sus datos",
  suspend_user: "Suspendió el acceso de un usuario",
  reactivate_user: "Reactivó el acceso de un usuario",
  remove_staff: "Eliminó a un dietista",
};

const when = (s: string) => {
  const d = new Date(s);
  return `${d.toLocaleDateString("es-ES")} ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
};

function Content() {
  const owner = useOwnerOnly();
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!owner) return;
    (async () => {
      const [a, p] = await Promise.all([
        supabase.from("audit_log").select("id,actor_id,action,table_name,record_id,created_at").order("created_at", { ascending: false }).limit(200),
        supabase.from("profiles").select("id,first_name,last_name"),
      ]);
      setRows((a.data ?? []) as unknown as Row[]);
      setNames(
        new Map(((p.data ?? []) as unknown as { id: string; first_name: string; last_name: string }[]).map((x) => [x.id, `${x.first_name} ${x.last_name}`.trim()])),
      );
      setLoaded(true);
    })();
  }, [owner]);

  if (!owner) return null;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand">Auditoría</h1>
        <p className="text-sm text-ink/60">Acciones sensibles realizadas en la aplicación (últimas 200).</p>
      </div>
      <Card>
        {!loaded ? (
          <p className="text-sm text-ink/50">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-ink/50">Todavía no hay registros.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {rows.map((r) => (
              <li key={r.id} className="py-2.5 text-sm">
                <p>
                  <strong>{(r.actor_id && names.get(r.actor_id)) || "Administrador"}</strong>: {ACTION[r.action] ?? r.action}
                </p>
                <p className="text-xs text-ink/50">{when(r.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function AuditoriaPage() {
  return (
    <Shell area="staff">
      <Content />
    </Shell>
  );
}
