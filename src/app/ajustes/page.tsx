"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Shell from "@/components/Shell";
import { Card, Field, btn, btnGhost, inputCls } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { fmtDate } from "@/lib/format";

type Member = { id: string; role: string; first_name: string; last_name: string };
type StaffInvite = { code: string; expires_at: string };

const ROLE_LABEL: Record<string, string> = {
  owner: "Administrador",
  dietitian: "Dietista",
};

function AjustesContent() {
  const { profile, refresh } = useAuth();
  const isOwner = profile?.role === "owner";

  const [first, setFirst] = useState(profile?.first_name ?? "");
  const [last, setLast] = useState(profile?.last_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<StaffInvite[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const m = await supabase
      .from("profiles")
      .select("id,role,first_name,last_name")
      .neq("role", "client")
      .order("created_at", { ascending: true });
    setMembers((m.data ?? []) as unknown as Member[]);
    if (isOwner) {
      const i = await supabase
        .from("staff_invites")
        .select("code,expires_at")
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      setInvites((i.data ?? []) as unknown as StaffInvite[]);
    }
  }, [isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const { error: err } = await supabase
      .from("profiles")
      .update({
        first_name: first.trim(),
        last_name: last.trim(),
        phone: phone.trim() || null,
      })
      .eq("id", profile.id);
    if (err) setError(friendly(err.message));
    else {
      setMsg("Perfil guardado");
      await refresh();
      await load();
    }
    setBusy(false);
  }

  async function createInvite() {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("staff_invites").insert({});
    if (err) setError(friendly(err.message));
    await load();
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-brand">Ajustes</h1>

      <Card title="Tu perfil">
        <form onSubmit={saveProfile} className="grid gap-3 md:grid-cols-2">
          <Field label="Nombre">
            <input required value={first} onChange={(e) => setFirst(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Apellidos">
            <input value={last} onChange={(e) => setLast(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Teléfono">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
          </Field>
          {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}
          {msg && <p className="text-sm text-brand md:col-span-2">{msg}</p>}
          <div className="md:col-span-2">
            <button disabled={busy} className={btn}>Guardar perfil</button>
          </div>
        </form>
      </Card>

      <Card title="Equipo">
        <ul className="mb-4 divide-y divide-black/5">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="font-medium">
                {`${m.first_name} ${m.last_name}`.trim() || "Sin nombre"}
              </span>
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
                {ROLE_LABEL[m.role] ?? m.role}
              </span>
            </li>
          ))}
        </ul>

        {isOwner ? (
          <>
            <p className="mb-3 text-sm text-ink/70">
              Para dar acceso al dietista, genera un código y envíaselo. Él crea
              su cuenta en la app, introduce el código y queda como dietista,
              con acceso a todos los clientes. El código caduca a los 7 días y
              solo sirve una vez.
            </p>
            {invites.length > 0 && (
              <ul className="mb-3 space-y-2">
                {invites.map((i) => (
                  <li key={i.code} className="flex flex-wrap items-center gap-3 rounded-xl bg-brand-soft px-4 py-3">
                    <code className="text-lg font-bold tracking-wider text-brand">{i.code}</code>
                    <span className="text-xs text-ink/60">caduca el {fmtDate(i.expires_at)}</span>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(i.code)}
                      className={`${btnGhost} ml-auto !py-1.5 text-xs`}
                    >
                      Copiar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => void createInvite()} disabled={busy} className={btn}>
              Generar código para el dietista
            </button>
          </>
        ) : (
          <p className="text-xs text-ink/50">
            Solo el administrador puede añadir miembros al equipo.
          </p>
        )}
      </Card>
    </div>
  );
}

export default function AjustesPage() {
  return (
    <Shell area="staff">
      <AjustesContent />
    </Shell>
  );
}
