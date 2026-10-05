"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Card } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Me = { first_name: string; goals: string | null; height_cm: number | null };

function HoyContent() {
  const { profile } = useAuth();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let active = true;
    // Gracias a RLS, un cliente solo recibe su propia fila.
    supabase
      .from("clients")
      .select("first_name,goals,height_cm")
      .maybeSingle()
      .then(({ data }) => {
        if (active) setMe((data as Me | null) ?? null);
      });
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

      {me?.goals && (
        <Card title="Tu objetivo">
          <p className="text-sm">{me.goals}</p>
        </Card>
      )}

      <Card title="Próximamente">
        <p className="text-sm text-ink/60">
          Aquí podrás registrar tu peso, subir tus fotos, ver tu plan de
          comidas, consultar recetas y escribir a tu dietista. Lo iremos
          activando por fases.
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
