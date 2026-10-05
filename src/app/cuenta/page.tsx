"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { Card, btn, btnGhost } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { fmtDate } from "@/lib/format";

type Req = { id: string; kind: string; status: string; created_at: string };

const WEEK = 7 * 24 * 3600;

function Content() {
  const { profile, session } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const c = await supabase.from("clients").select("id").maybeSingle();
    const id = (c.data as { id: string } | null)?.id ?? null;
    setClientId(id);
    if (id) {
      const r = await supabase
        .from("data_requests")
        .select("id,kind,status,created_at")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      setReqs((r.data ?? []) as unknown as Req[]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportData() {
    if (!clientId) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const by = (t: string) => supabase.from(t).select("*").eq("client_id", clientId);
      const [cl, me, mt, rv, ph, fp, dc, pl, lg, ms, co] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId),
        by("measurements"),
        supabase.from("measurement_types").select("id,name,unit"),
        by("reviews"),
        by("photos"),
        by("food_photos"),
        by("documents"),
        by("meal_plans"),
        by("meal_logs"),
        by("messages"),
        supabase.from("consents").select("*").eq("user_id", session?.user.id ?? ""),
      ]);
      const plans = (pl.data ?? []) as unknown as { id: string }[];
      const items = plans.length
        ? await supabase.from("meal_plan_items").select("*").in("plan_id", plans.map((p) => p.id))
        : { data: [] };

      // Enlaces temporales (7 días) a tus fotos y documentos
      const links = async (bucket: string, rows: { storage_path: string }[]) => {
        if (!rows.length) return [];
        const { data } = await supabase.storage.from(bucket).createSignedUrls(
          rows.map((r) => r.storage_path),
          WEEK,
        );
        return (data ?? []).map((d) => ({ archivo: d.path, enlace_7_dias: d.signedUrl }));
      };
      const photoRows = (ph.data ?? []) as unknown as { storage_path: string }[];
      const foodRows = (fp.data ?? []) as unknown as { storage_path: string }[];
      const docRows = (dc.data ?? []) as unknown as { storage_path: string }[];

      const out = {
        generado: new Date().toISOString(),
        ficha: cl.data,
        tipos_de_medida: mt.data,
        medidas: me.data,
        revisiones: rv.data,
        fotos_progreso: ph.data,
        fotos_comidas: fp.data,
        documentos: dc.data,
        planes: pl.data,
        comidas_del_plan: items.data,
        comidas_marcadas: lg.data,
        mensajes: ms.data,
        consentimientos: co.data,
        descarga_de_archivos: [
          ...(await links("photos", [...photoRows, ...foodRows])),
          ...(await links("documents", docRows)),
        ],
      };
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg("Datos descargados. Los enlaces a tus fotos y documentos caducan en 7 días.");
    } catch (e) {
      setError(friendly(e instanceof Error ? e.message : "No se han podido descargar los datos"));
    }
    setBusy(false);
  }

  async function requestDelete() {
    if (!clientId) return;
    if (!window.confirm("¿Quieres solicitar el borrado de tu cuenta y de todos tus datos? Tu dietista lo tramitará.")) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("data_requests").insert({ client_id: clientId, kind: "delete" });
    if (err) setError(friendly(err.message));
    else setMsg("Solicitud enviada. Tu dietista la tramitará.");
    await load();
    setBusy(false);
  }

  const pending = reqs.some((r) => r.kind === "delete" && r.status === "pending");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand">Mi cuenta</h1>
        <p className="text-sm text-ink/60">
          {profile?.first_name} {profile?.last_name} · {session?.user.email}
        </p>
      </div>

      <Card title="Mis datos">
        <p className="mb-3 text-sm text-ink/70">
          Descarga una copia de todos tus datos (peso, medidas, planes, mensajes…) en un archivo.
        </p>
        <button disabled={busy || !clientId} onClick={() => void exportData()} className={btn}>
          {busy ? "Preparando…" : "Descargar mis datos"}
        </button>
      </Card>

      <Card title="Borrar mi cuenta">
        <p className="mb-3 text-sm text-ink/70">
          Puedes pedir que se eliminen tu cuenta y todos tus datos. Tu dietista tramitará la solicitud
          (algunos datos pueden conservarse el tiempo que exija la ley).
        </p>
        {pending ? (
          <p className="text-sm font-semibold text-brand">Solicitud pendiente de tramitar.</p>
        ) : (
          <button disabled={busy || !clientId} onClick={() => void requestDelete()} className={btnGhost}>
            Solicitar el borrado
          </button>
        )}
        {reqs.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-ink/50">
            {reqs.map((r) => (
              <li key={r.id}>
                {fmtDate(r.created_at)} · {r.kind === "delete" ? "Borrado" : "Descarga"} ·{" "}
                {r.status === "done" ? "atendida" : "pendiente"}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-brand">{msg}</p>}

      <p className="text-xs">
        <Link href="/privacidad/" className="text-brand underline">
          Política de privacidad
        </Link>
      </p>
    </div>
  );
}

export default function CuentaPage() {
  return (
    <Shell area="client">
      <Content />
    </Shell>
  );
}
