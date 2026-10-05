"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import DiarioComidas from "@/components/DiarioComidas";
import FotosProgreso from "@/components/FotosProgreso";
import { Card } from "@/components/ui";
import { supabase } from "@/lib/supabase";

type Me = { id: string; clinic_id: string };

function FotosContent() {
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
        <h1 className="text-2xl font-bold text-brand">Mis fotos</h1>
        <p className="text-sm text-ink/60">
          Solo tú y tu dietista podéis verlas.
        </p>
      </div>
      <DiarioComidas clientId={me.id} clinicId={me.clinic_id} canUpload />
      <FotosProgreso
        clientId={me.id}
        clinicId={me.clinic_id}
        canUpload
        canDelete={false}
      />
    </div>
  );
}

export default function FotosPage() {
  return (
    <Shell area="client">
      <FotosContent />
    </Shell>
  );
}
