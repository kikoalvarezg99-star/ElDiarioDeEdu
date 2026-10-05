"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Card, btn, inputCls } from "./ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";

type Msg = { id: string; sender_id: string; body: string; read_at: string | null; created_at: string };

const hhmm = (s: string) => {
  const d = new Date(s);
  return `${d.getDate()}/${d.getMonth() + 1} ${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
};

/** Conversación privada entre un cliente y su dietista. */
export default function Chat({
  clientId,
  otherName,
  title = "Mensajes",
}: {
  clientId: string;
  otherName: string;
  title?: string;
}) {
  const { session } = useAuth();
  const me = session?.user.id ?? "";
  const [convId, setConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  const load = useCallback(async () => {
    let id = convId;
    if (!id) {
      const c = await supabase.from("conversations").select("id").eq("client_id", clientId).maybeSingle();
      id = (c.data as { id: string } | null)?.id ?? null;
      setConvId(id);
    }
    if (!id) {
      setLoaded(true);
      return;
    }
    const m = await supabase
      .from("messages")
      .select("id,sender_id,body,read_at,created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(300);
    const list = (m.data ?? []) as unknown as Msg[];
    setMsgs(list);
    setLoaded(true);

    // Lo recibido pasa a "leído" y se limpian los avisos de este cliente
    if (me && list.some((x) => x.sender_id !== me && !x.read_at)) {
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", id)
        .neq("sender_id", me)
        .is("read_at", null);
    }
    if (me) {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", me)
        .eq("payload->>client_id", clientId)
        .is("read_at", null);
    }
  }, [clientId, convId, me]);

  useEffect(() => {
    void load();
    // Se actualiza solo cada 10 s mientras la pestaña está a la vista
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (msgs.length !== count.current) {
      count.current = msgs.length;
      endRef.current?.scrollIntoView({ block: "end" });
    }
  }, [msgs]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !convId) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("messages").insert({ conversation_id: convId, body });
    if (err) setError(friendly(err.message));
    else {
      setText("");
      await load();
    }
    setBusy(false);
  }

  return (
    <Card title={title}>
      {!loaded ? (
        <p className="text-sm text-ink/50">Cargando…</p>
      ) : !convId ? (
        <p className="text-sm text-ink/60">La conversación todavía no está disponible.</p>
      ) : (
        <div className="space-y-3">
          <div className="max-h-96 min-h-24 space-y-2 overflow-y-auto rounded-xl bg-brand-soft/40 p-3">
            {msgs.length === 0 && <p className="text-sm text-ink/50">Aún no hay mensajes. Escribe el primero.</p>}
            {msgs.map((m) => {
              const mine = m.sender_id === me;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-brand text-white" : "bg-white ring-1 ring-black/5"}`}>
                    {!mine && <p className="mb-0.5 text-[11px] font-semibold text-brand">{otherName}</p>}
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`mt-0.5 text-[10px] ${mine ? "text-white/60" : "text-ink/40"}`}>
                      {hhmm(m.created_at)}
                      {mine && m.read_at ? " · leído" : ""}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          <form onSubmit={send} className="flex gap-2">
            <input
              value={text}
              maxLength={4000}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escribe un mensaje…"
              className={inputCls}
            />
            <button disabled={busy || !text.trim()} className={btn}>
              Enviar
            </button>
          </form>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Card>
  );
}
