"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Row = { id: string; type: string; payload: { client_id?: string } | null };
type Toast = { id: string; text: string; href: string };

const WHAT: Record<string, string> = {
  messages_from_client: "te ha escrito un mensaje",
  measurements_from_client: "ha registrado su peso o sus medidas",
  photos_from_client: "ha subido una foto de progreso",
  food_photos_from_client: "ha subido una foto de comida",
  data_requests_from_client: "ha hecho una solicitud sobre sus datos",
};

/** Avisos en pantalla para el dietista: aparecen cuando un cliente escribe o sube algo. */
export default function AvisosStaff() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const seen = useRef<Set<string> | null>(null);
  const baseTitle = useRef<string>("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [perm, setPerm] = useState<string>("unsupported");

  useEffect(() => {
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
  }, []);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    baseTitle.current = document.title.replace(/^\(\d+\)\s*/, "");

    const poll = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,type,payload")
        .eq("user_id", uid)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!active) return;
      const rows = (data ?? []) as unknown as Row[];
      document.title = rows.length ? `(${rows.length}) ${baseTitle.current}` : baseTitle.current;

      if (seen.current === null) {
        // Primera carga: lo que ya estaba pendiente no se anuncia
        seen.current = new Set(rows.map((r) => r.id));
        return;
      }
      const fresh = rows.filter((r) => !seen.current!.has(r.id));
      if (fresh.length === 0) return;
      fresh.forEach((r) => seen.current!.add(r.id));

      const ids = [...new Set(fresh.map((r) => r.payload?.client_id).filter((x): x is string => !!x))];
      const names = new Map<string, string>();
      if (ids.length) {
        const c = await supabase.from("clients").select("id,first_name,last_name").in("id", ids);
        ((c.data ?? []) as unknown as { id: string; first_name: string; last_name: string | null }[]).forEach((x) =>
          names.set(x.id, `${x.first_name} ${x.last_name ?? ""}`.trim()),
        );
      }
      if (!active) return;
      const made = fresh.map((r) => {
        const cid = r.payload?.client_id ?? "";
        return {
          id: r.id,
          text: `${names.get(cid) ?? "Un cliente"} ${WHAT[r.type] ?? "tiene novedades"}`,
          href: cid ? `/cliente/?id=${cid}` : "/clientes/",
        };
      });
      setToasts((t) => [...made, ...t].slice(0, 4));
      made.forEach((m) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== m.id)), 12000));

      if (document.visibilityState === "hidden" && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("Eduardo Rivero · Nutrición", { body: made[0].text });
        } catch {
          // algunos navegadores no permiten crearlas desde aquí
        }
      }
    };

    void poll();
    const t = setInterval(() => void poll(), 15000);
    return () => {
      active = false;
      clearInterval(t);
      document.title = baseTitle.current;
    };
  }, [uid]);

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-50 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-start gap-2 rounded-xl bg-white p-3 text-sm shadow-lg ring-1 ring-brand/30">
          <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
          <Link href={t.href} className="flex-1 font-medium text-brand hover:underline" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
            {t.text}
          </Link>
          <button type="button" aria-label="Cerrar" className="text-ink/40" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
            ✕
          </button>
        </div>
      ))}
      {perm === "default" && (
        <button
          type="button"
          className="pointer-events-auto self-end rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow"
          onClick={() => void Notification.requestPermission().then((p) => setPerm(p))}
        >
          Activar avisos del navegador
        </button>
      )}
    </div>
  );
}
