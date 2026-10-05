"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Splash, base } from "./ui";

type Area = "staff" | "client";

const NAV: Record<Area, { href: string; label: string }[]> = {
  staff: [
    { href: "/panel/", label: "Panel" },
    { href: "/clientes/", label: "Clientes" },
  ],
  client: [{ href: "/hoy/", label: "Hoy" }],
};

export default function Shell({
  area,
  children,
}: {
  area: Area;
  children: ReactNode;
}) {
  const { session, profile, loading, isStaff, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "";

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace("/login/");
    else if (!profile) router.replace("/onboarding/");
    else if (area === "staff" && !isStaff) router.replace("/hoy/");
    else if (area === "client" && isStaff) router.replace("/panel/");
  }, [loading, session, profile, isStaff, area, router]);

  if (loading || !session || !profile || (area === "staff") !== isStaff) {
    return <Splash />;
  }

  const items = NAV[area];
  const isActive = (href: string) => pathname.startsWith(href.replace(/\/$/, ""));
  const name = `${profile.first_name} ${profile.last_name}`.trim();

  return (
    <div className="min-h-screen md:flex">
      {/* Barra lateral (ordenador) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 bg-brand p-5 text-white md:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${base}/logo-full.svg`}
          alt="Eduardo Rivero"
          className="w-32 rounded-xl"
        />
        <nav className="flex flex-col gap-1">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive(it.href)
                  ? "bg-white/15"
                  : "text-white/75 hover:bg-white/10"
              }`}
            >
              {it.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto text-sm">
          <p className="font-semibold">{name || "Mi cuenta"}</p>
          <p className="mb-3 text-xs text-white/60">
            {isStaff ? "Dietista" : "Cliente"}
          </p>
          <button
            onClick={() => void signOut()}
            className="text-xs text-white/70 underline underline-offset-2 hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 pb-20 md:pb-0">
        {/* Cabecera (móvil) */}
        <header className="sticky top-0 z-10 flex items-center justify-between bg-brand px-4 py-2.5 text-white md:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${base}/logo-full.svg`}
            alt="Eduardo Rivero"
            className="h-9 w-9 rounded-lg"
          />
          <button
            onClick={() => void signOut()}
            className="text-xs text-white/80 underline underline-offset-2"
          >
            Cerrar sesión
          </button>
        </header>

        <main className="mx-auto w-full max-w-5xl p-4 md:p-8">{children}</main>
      </div>

      {/* Navegación inferior (móvil) */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-black/10 bg-white md:hidden">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`flex-1 py-3.5 text-center text-sm font-semibold ${
              isActive(it.href) ? "text-brand" : "text-ink/50"
            }`}
          >
            {it.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
