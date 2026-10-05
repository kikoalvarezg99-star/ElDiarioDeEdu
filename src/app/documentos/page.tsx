"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import Documentos from "@/components/Documentos";
import { Card } from "@/components/ui";
import { supabase } from "@/lib/supabase";

type Me = { id: string; clinic_id: string };

function Content() {
  const [me, setMe] = useState<Me | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("clients")
      .select("id,clinic_id")
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setMe((data as Me | null) ?? null);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) return <p className="text-sm text-ink/50">Cargando…</p>;
  if (!me) {
    return (
      <Card>
        <p className="text-sm">No se ha encontrado tu ficha. Avisa a tu dietista.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand">Mis documentos</h1>
        <p className="text-sm text-ink/60">Dietas, analíticas e informes que te envía tu dietista.</p>
      </div>
      <Documentos clientId={me.id} clinicId={me.clinic_id} canUpload={false} />
    </div>
  );
}

export default function DocumentosPage() {
  return (
    <Shell area="client">
      <Content />
    </Shell>
  );
}
