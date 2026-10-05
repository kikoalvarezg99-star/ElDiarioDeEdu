"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import Evolucion from "@/components/Evolucion";
import PesoDiario from "@/components/PesoDiario";
import AsistentePlatos from "@/components/AsistentePlatos";
import InstalarApp from "@/components/InstalarApp";
import PlanCliente from "@/components/PlanCliente";
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

// Constante fuera del componente para que sea estable entre renders.
const WEIGHT_ONLY = ["weight"];

function HoyContent() {
  const { profile } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [nextReview, setNextReview] = useState<string | null>(null);
  const [evoKey, setEvoKey] = useState(0);

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

      {me && (
        <PesoDiario clientId={me.id} onSaved={() => setEvoKey((k) => k + 1)} />
      )}

      {me && <PlanCliente clientId={me.id} />}

      {me && <AsistentePlatos />}

      {me && (
        <Evolucion
          key={evoKey}
          clientId={me.id}
          heightCm={me.height_cm}
          staff={false}
          only={WEIGHT_ONLY}
          title="Historial de tu peso"
          readOnly
        />
      )}

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

      <InstalarApp />
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
