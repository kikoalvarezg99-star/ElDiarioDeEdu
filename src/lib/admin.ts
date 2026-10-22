import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth";

export type AdminUser = {
  user_id: string;
  role: string;
  first_name: string;
  last_name: string;
  email: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  banned: boolean;
  client_id: string | null;
};

/** Páginas solo del administrador: a los demás los devuelve al panel. */
export function useOwnerOnly(): boolean {
  const { profile } = useAuth();
  const router = useRouter();
  const ok = profile?.role === "owner";
  useEffect(() => {
    if (profile && !ok) router.replace("/panel/");
  }, [profile, ok, router]);
  return ok;
}

export const mb = (bytes: number) => bytes / 1048576;
