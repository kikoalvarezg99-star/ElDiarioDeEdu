"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import Evolucion from "@/components/Evolucion";
import { Card } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { fmtDate, todayISO } from "@/lib/format";

type Me = {
  id: string;
  first_name: string;
  goals: string | null;
  height_cm: number | null;
};

function HoyContent() {
  const { profile } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [nextReview, setNextReview] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      // Gracias a RLS, un cliente solo recibe su propia fila.
      const c = await supabase
        .from("clients")
        .select("id,first_name,goals,height_cm")
        .maybeSingle();
      if (!active) return;
      setMe((c.data as Me | null) ?? null);

      const r = await supabase
        .from("reviews")
        .select("next_review_on")
        .gte("next_review_on", todayISO())
        .order("next_review_on", { ascending: true })
        .limit(1);
      if (!active) return;
      const row = (r.data ?? [])[0] as { next_review_on: string } | undefined;
      setNextReview(row?.next_review_on ?? null);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand">
          Hola, {me?.first_name || profile?.first_name}
        </h1>
        <p className="text-sm text-ink/60">Este es tu espacio privado.</p>
      </div>

      {nextReview && (
        <Card title="Próxima revisión">
          <p className="text-lg font-bold text-brand">{fmtDate(nextReview)}</p>
        </Card>
      )}

      {me?.goals && (
        <Card title="Tu objetivo">
          <p className="text-sm">{me.goals}</p>
        </Card>
      )}

      {me && <Evolucion clientId={me.id} heightCm={me.height_cm} staff={false} />}

      <Card title="Próximamente">
        <p className="text-sm text-ink/60">
          Pronto podrás subir tus fotos, ver tu plan de comidas, consultar
          recetas y escribir a tu dietista.
        </p>
      </Card>
    </div>
  );
}

export default function HoyPage() {
  return (
    <Shell area="client">
      <HoyContent />
    </Shell>
  );
}
