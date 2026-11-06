"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Club = {
  id: string;
  slug: string;
  name: string;
  username: string | null;
  hasLogin: boolean;
  active: boolean;
  members: number;
};

/** Cue Point admin: partner clubs (e.g. Infinity Pool Club) and their admin logins. */
export function ClubsAdminTab() {
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", password: "" });
  const [edit, setEdit] = useState<{ id: string; username: string; password: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/clubs", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setClubs(d.clubs ?? []))
      .catch(() => setClubs([]));
  }, []);
  useEffect(() => load(), [load]);

  async function send(method: "POST" | "PATCH", body: unknown, ok: string) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/clubs", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: d.error || "Could not save" });
      return false;
    }
    setClubs(d.clubs ?? []);
    setMsg({ ok: true, text: ok });
    return true;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
        <h3 className="font-display text-lg font-semibold text-white">Add a partner club</h3>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-mist">
          The club gets its own admin sign-in at{" "}
          <Link href="/clubs/admin" className="underline">
            /clubs/admin
          </Link>
          . Its players register normal Cue Point accounts; the club admin adds them to the club, puts them in
          groups and runs a weekly league in every group.
        </p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send("POST", form, `${form.name} added. Give the club admin the username and password.`))
              setForm({ name: "", username: "", password: "" });
          }}
        >
          <input
            className="input"
            placeholder="Club name (e.g. Infinity Pool Club)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="input"
            placeholder="Admin username"
            autoComplete="off"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            className="input"
            type="password"
            placeholder="Password (8+ characters)"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <button
            className="btn-primary justify-center px-4 py-2 text-sm"
            disabled={busy || !form.name || !form.username || form.password.length < 8}
          >
            Create club
          </button>
        </form>
      </div>

      {msg && (
        <p className={msg.ok ? "text-sm text-teal" : "text-sm text-red-300"} role={msg.ok ? undefined : "alert"}>
          {msg.text}
        </p>
      )}

      <div className="space-y-3">
        {clubs === null && <p className="text-sm text-mist">Loading…</p>}
        {clubs?.length === 0 && <p className="text-sm text-mist">No partner clubs yet.</p>}
        {clubs?.map((c) => (
          <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold text-white">
                  {c.name}{" "}
                  {!c.active && <span className="ml-1 rounded-full bg-red-400/15 px-2 py-0.5 text-[11px] text-red-300">off</span>}
                </p>
                <p className="text-xs text-mist">
                  Login: <span className="text-white/90">{c.username ?? "—"}</span> · {c.members} member
                  {c.members === 1 ? "" : "s"} ·{" "}
                  <Link href={`/clubs/${c.slug}`} className="underline">
                    public page
                  </Link>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-ghost px-3 py-1.5 text-xs"
                  onClick={() => setEdit({ id: c.id, username: c.username ?? "", password: "" })}
                >
                  Change login
                </button>
                <button
                  className="btn-ghost px-3 py-1.5 text-xs"
                  disabled={busy}
                  onClick={() =>
                    send("PATCH", { id: c.id, active: !c.active }, c.active ? `${c.name} switched off.` : `${c.name} switched on.`)
                  }
                >
                  {c.active ? "Switch off" : "Switch on"}
                </button>
              </div>
            </div>
            {edit?.id === c.id && (
              <form
                className="mt-4 grid gap-3 sm:grid-cols-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const body: Record<string, unknown> = { id: c.id, username: edit.username };
                  if (edit.password) body.password = edit.password;
                  if (await send("PATCH", body, "Login updated. A new password signs the old one out.")) setEdit(null);
                }}
              >
                <input
                  className="input"
                  value={edit.username}
                  autoComplete="off"
                  onChange={(e) => setEdit({ ...edit, username: e.target.value })}
                />
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  placeholder="New password (leave empty to keep)"
                  value={edit.password}
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                />
                <button className="btn-primary justify-center px-4 py-2 text-sm" disabled={busy}>
                  Save
                </button>
                <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={() => setEdit(null)}>
                  Cancel
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
