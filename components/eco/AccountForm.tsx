"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Mode = "signin" | "join";

export function AccountForm({
  initialMode,
  nextPath,
  firstEver,
}: {
  initialMode: Mode;
  nextPath: string;
  firstEver: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [form, setForm] = useState({
    fullName: "",
    nickname: "",
    email: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        mode === "join" ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "join"
              ? form
              : { email: form.email, password: form.password },
          ),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[24px] border border-white/10 glass-strong p-6 sm:p-7">
      {!firstEver && (
        <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1 text-[13px]">
          {(["signin", "join"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn(
                "relative rounded-full px-4 py-1.5 font-medium transition-colors",
                mode === m ? "text-navy-950" : "text-mist hover:text-white",
              )}
            >
              {mode === m && (
                <motion.span
                  layoutId="acct-tab"
                  className="absolute inset-0 rounded-full bg-teal"
                  transition={{ type: "spring", stiffness: 320, damping: 30 }}
                />
              )}
              <span className="relative">
                {m === "signin" ? "Sign in" : "Create account"}
              </span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {mode === "join" && (
            <motion.div
              key="join-fields"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3.5 overflow-hidden"
            >
              <Field label="Full name">
                <input
                  className="input"
                  value={form.fullName}
                  onChange={set("fullName")}
                  autoComplete="name"
                  placeholder="Ishara Perera"
                />
              </Field>
              <Field label="Player name" hint="Shown on the leaderboard">
                <input
                  className="input"
                  value={form.nickname}
                  onChange={set("nickname")}
                  autoComplete="nickname"
                  placeholder="CueBallIsh"
                />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>

        <Field label="Email">
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={set("email")}
            autoComplete="email"
            placeholder="you@email.com"
          />
        </Field>
        <Field label="Password">
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={set("password")}
            autoComplete={mode === "join" ? "new-password" : "current-password"}
            placeholder={mode === "join" ? "At least 8 characters" : "••••••••"}
          />
        </Field>

        {error && (
          <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="btn-primary w-full py-3 text-sm disabled:opacity-60"
        >
          {busy
            ? "…"
            : mode === "join"
              ? firstEver
                ? "Create admin account"
                : "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-[11px] text-mist">
        {mode === "signin" ? (
          <>
            New here?{" "}
            <button
              onClick={() => setMode("join")}
              className="font-medium text-teal"
            >
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have one?{" "}
            <button
              onClick={() => setMode("signin")}
              className="font-medium text-teal"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs text-mist">
        {label}
        {hint && <span className="text-[10px] text-mist/50">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
