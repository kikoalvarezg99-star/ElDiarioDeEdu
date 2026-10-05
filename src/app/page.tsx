"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Splash } from "@/components/ui";

/** Puerta de entrada: lleva a cada persona a su sitio según sesión y rol. */
export default function Home() {
  const { session, profile, loading, isStaff } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login/");
    else if (!profile) router.replace("/onboarding/");
    else router.replace(isStaff ? "/panel/" : "/hoy/");
  }, [loading, session, profile, isStaff, router]);

  return <Splash />;
}
