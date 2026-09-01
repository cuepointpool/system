"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BracketView } from "./BracketView";
import { Countdown, PlayerAvatar } from "./Primitives";
import { STATUS_META, FORMAT_LABEL } from "./TournamentCard";
import { MagneticButton } from "@/components/MagneticButton";
import { cn, formatDayTime, formatDateShort, formatLKR } from "@/lib/utils";
import type {
  PlayerLite,
  Tournament,
  TournamentStatus,
} from "@/lib/ecosystem/types";

export function TournamentDetail({
  tournament,
  players,
  spotsLeft,
  registered: registeredInitial,
  viewerName,
}: {
  tournament: Tournament & { status: TournamentStatus };
  players: Record<string, PlayerLite>;
  spotsLeft: number;
  registered: boolean;
  viewerName: string | null;
}) {
  const t = tournament;
  const meta = STATUS_META[t.status];
  const router = useRouter();
  const [registered, setRegistered] = useState(registeredInitial);
  const [count, setCount] = useState(
    t.registrations.filter((r) => r.playerId).length,
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function register() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/tournaments/${t.slug}`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not register");
      setRegistered(true);
      setCount(d.registeredCount ?? count + 1);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not register");
    } finally {
      setBusy(false);
    }
  }

  const [mountNow] = useState(() => Date.now());
  const future = +new Date(t.startAt) > mountNow;
  const registeredPlayers = t.registrations
    .filter((r) => r.playerId)
    .map((r) => ({ seed: r.seed, p: players[r.playerId!] }))
    .filter((x) => x.p);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
      {/* hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/10">
        <div
          className="absolute inset-0"
          style={{
            background:
              t.cover === "masters"
                ? "linear-gradient(135deg,#0c4a4a,#062231)"
                : t.cover === "autumn"
                  ? "linear-gradient(135deg,#1a3a2a,#062231)"
                  : "linear-gradient(135deg,#0e2b46,#05101c)",
          }}
        />
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.4),transparent_40%),radial-gradient(circle_at_85%_70%,rgba(0,194,168,0.5),transparent_45%)]" />
        <div className="relative p-6 sm:p-9">
          <Link
            href="/tournaments"
            className="text-xs text-white/70 transition-colors hover:text-white"
          >
            ← All tournaments
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1",
                meta.cls,
              )}
            >
              {meta.label}
            </span>
            <span className="rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-medium text-white ring-1 ring-white/10">
              {FORMAT_LABEL[t.format]}
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-white sm:text-5xl">
            {t.name}
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/80">{t.summary}</p>

          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
            <HeroFact k="Starts" v={formatDayTime(t.startAt)} />
            <HeroFact k="Venue" v={t.venue} />
            <HeroFact
              k="Prize pool"
              v={formatLKR(t.prizePool)}
              accent
            />
            <HeroFact
              k="Entry fee"
              v={t.entryFee === 0 ? "Free" : formatLKR(t.entryFee)}
            />
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            {t.status === "registration_open" ? (
              registered ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-teal/40 bg-teal/15 px-5 py-3 text-sm font-semibold text-teal">
                  <span aria-hidden>✓</span> You are registered
                </span>
              ) : spotsLeft > 0 ? (
                <MagneticButton onClick={register} ariaLabel="Register for tournament">
                  {busy ? "Registering…" : "Register for Tournament"}
                </MagneticButton>
              ) : (
                <span className="rounded-full border border-white/15 px-5 py-3 text-sm text-mist">
                  Tournament full
                </span>
              )
            ) : t.status === "completed" && t.championId ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-teal-bright/40 bg-teal-bright/10 px-5 py-3 text-sm font-semibold text-teal-bright">
                🏆 Champion: {players[t.championId]?.nickname}
              </span>
            ) : t.status === "live" ? (
              <span className="rounded-full border border-rose-400/40 bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-300">
                ● Live — bracket below
              </span>
            ) : null}

            {future && t.status !== "completed" && (
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-wide text-white/60">
                  {t.status === "registration_open"
                    ? "Registration closes in"
                    : "Starts in"}
                </span>
                <Countdown
                  to={
                    t.status === "registration_open"
                      ? t.registrationDeadline
                      : t.startAt
                  }
                  compact
                />
              </div>
            )}
          </div>
          {err && <p className="mt-3 text-xs text-rose-300">{err}</p>}
          {!viewerName && t.status === "registration_open" && !registered && (
            <p className="mt-2 text-[11px] text-white/60">
              Registering as your active Cue Point profile.
            </p>
          )}
        </div>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        {/* left */}
        <div className="space-y-8">
          <Panel title="Bracket">
            <BracketView
              bracket={t.bracket}
              players={players}
              championId={t.championId}
            />
          </Panel>

          <Panel title="Rules">
            <ul className="space-y-2.5">
              {t.rules.map((r) => (
                <li key={r} className="flex gap-3 text-sm text-mist">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal" />
                  {r}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* right */}
        <div className="space-y-8">
          <Panel title="Tournament info">
            <dl className="divide-y divide-white/8 text-sm">
              <Row k="Format" v={FORMAT_LABEL[t.format]} />
              <Row k="Starts" v={formatDayTime(t.startAt)} />
              <Row
                k="Registration deadline"
                v={formatDateShort(t.registrationDeadline)}
              />
              <Row k="Players" v={`${count} / ${t.maxPlayers}`} />
              <Row
                k="Entry fee"
                v={t.entryFee === 0 ? "Free" : formatLKR(t.entryFee)}
              />
              <Row k="Prize pool" v={formatLKR(t.prizePool)} accent />
            </dl>
          </Panel>

          <Panel title="Prize breakdown">
            <ul className="space-y-2">
              {t.prizeBreakdown.map((p) => (
                <li
                  key={p.place}
                  className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-sm"
                >
                  <span className="text-mist">{p.place}</span>
                  <span className="font-semibold text-white">
                    {formatLKR(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={`Registered players (${registeredPlayers.length})`}>
            {registeredPlayers.length === 0 ? (
              <p className="text-sm text-mist">No registrations yet — be the first.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {registeredPlayers
                  .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))
                  .map(({ seed, p }) => (
                    <li key={p.id}>
                      <Link
                        href={`/players/${p.slug}`}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
                      >
                        <span className="w-5 text-center text-[11px] text-mist/50">
                          {seed ?? "–"}
                        </span>
                        <PlayerAvatar name={p.fullName} src={p.avatar} size="xs" />
                        <span className="truncate text-[13px] text-white">
                          {p.nickname}
                        </span>
                        <span className="ml-auto text-[11px] text-mist/60">
                          #{p.rank}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
    >
      <h2 className="mb-4 text-xs uppercase tracking-[0.24em] text-teal">
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

function HeroFact({
  k,
  v,
  accent,
}: {
  k: string;
  v: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/50">{k}</div>
      <div
        className={cn(
          "mt-0.5 text-sm font-semibold",
          accent ? "text-teal-bright" : "text-white",
        )}
      >
        {v}
      </div>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-mist">{k}</dt>
      <dd className={cn(accent ? "font-semibold text-teal-bright" : "text-white/90")}>
        {v}
      </dd>
    </div>
  );
}
