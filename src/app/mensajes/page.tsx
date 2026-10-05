"use client";

import Shell from "@/components/Shell";
import Chat from "@/components/Chat";
import { Card } from "@/components/ui";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function Content() {
  const [id, setId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("clients")
      .select("id")
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setId((data as { id: string } | null)?.id ?? null);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) return <p className="text-sm text-ink/50">Cargando…</p>;
  if (!id)
    return (
      <Card>
        <p className="text-sm">No se ha encontrado tu ficha. Avisa a tu dietista.</p>
      </Card>
    );
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand">Mensajes</h1>
        <p className="text-sm text-ink/60">Conversación privada con tu dietista.</p>
      </div>
      <Chat clientId={id} otherName="Tu dietista" title="Chat" />
    </div>
  );
}

export default function MensajesPage() {
  return (
    <Shell area="client">
      <Content />
    </Shell>
  );
}
