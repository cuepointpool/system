"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Countdown } from "./Primitives";
import { cn, formatLKR, formatDayTime } from "@/lib/utils";
import type { Tournament, TournamentStatus } from "@/lib/ecosystem/types";

export const STATUS_META: Record<
  TournamentStatus,
  { label: string; cls: string }
> = {
  registration_open: { label: "Registration open", cls: "bg-teal/15 text-teal ring-teal/30" },
  registration_closed: { label: "Registration closed", cls: "bg-white/[0.06] text-mist ring-white/12" },
  upcoming: { label: "Upcoming", cls: "bg-sky-400/12 text-sky-200 ring-sky-300/25" },
  live: { label: "● Live", cls: "bg-rose-500/15 text-rose-300 ring-rose-400/30" },
  completed: { label: "Completed", cls: "bg-white/[0.06] text-mist ring-white/12" },
  cancelled: { label: "Cancelled", cls: "bg-white/[0.04] text-mist/60 ring-white/10" },
};

const COVER_GRADIENT: Record<string, string> = {
  autumn: "linear-gradient(135deg,#1a3a2a,#062231)",
  winter: "linear-gradient(135deg,#0e2b46,#05101c)",
  masters: "linear-gradient(135deg,#0c4a4a,#062231)",
};

export function TournamentCard({
  t,
  registeredCount,
  spotsLeft,
  delay = 0,
}: {
  t: Tournament & { status: TournamentStatus };
  registeredCount: number;
  spotsLeft: number;
  delay?: number;
}) {
  const meta = STATUS_META[t.status];
  const fill = Math.round((registeredCount / t.maxPlayers) * 100);
  const [mountNow] = useState(() => Date.now());
  const future = +new Date(t.startAt) > mountNow;

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ease: [0.16, 1, 0.3, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition-all duration-300 hover:-translate-y-1 hover:border-teal/30 hover:shadow-[0_30px_70px_-40px_rgba(0,194,168,0.4)]"
    >
      <Link href={`/tournaments/${t.slug}`} data-cursor="hot" className="block">
        <div
          className="relative h-36 overflow-hidden"
          style={{ background: COVER_GRADIENT[t.cover] ?? COVER_GRADIENT.winter }}
        >
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.4),transparent_40%),radial-gradient(circle_at_80%_60%,rgba(0,194,168,0.4),transparent_45%)]" />
          <div className="absolute inset-0 grid place-items-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[#05090f]/80 font-display text-lg text-white ring-1 ring-white/10">
              8
            </span>
          </div>
          <span
            className={cn(
              "absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1",
              meta.cls,
            )}
          >
            {meta.label}
          </span>
          <span className="absolute bottom-3 right-3 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white ring-1 ring-white/10">
            {FORMAT_LABEL[t.format]}
          </span>
        </div>

        <div className="p-5">
          <h3 className="font-display text-lg font-bold text-white">{t.name}</h3>
          <p className="mt-1 line-clamp-2 text-[13px] text-mist">{t.summary}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
            <Field k="Starts" v={formatDayTime(t.startAt)} />
            <Field k="Prize pool" v={formatLKR(t.prizePool)} accent />
            <Field k="Entry" v={t.entryFee === 0 ? "Free" : formatLKR(t.entryFee)} />
            <Field k="Venue" v={t.venue.split(",")[0]} />
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[11px] text-mist">
              <span>
                {registeredCount}/{t.maxPlayers} players
              </span>
              {t.status === "registration_open" && spotsLeft > 0 && (
                <span className="text-teal">{spotsLeft} spots left</span>
              )}
            </div>
            <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${fill}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="block h-full rounded-full bg-gradient-to-r from-teal-deep to-teal"
              />
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between">
            {t.status === "registration_open" ? (
              <span className="text-xs font-semibold text-teal">
                Register now →
              </span>
            ) : t.status === "live" ? (
              <span className="text-xs font-semibold text-rose-300">
                Watch the bracket →
              </span>
            ) : t.status === "completed" ? (
              <span className="text-xs text-mist">View results →</span>
            ) : (
              <span className="text-xs text-mist">Details →</span>
            )}
            {future && t.status !== "completed" && (
              <Countdown to={t.startAt} compact />
            )}
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

function Field({
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
      <div className="text-[10px] uppercase tracking-wider text-mist/50">{k}</div>
      <div
        className={cn(
          "mt-0.5 font-medium",
          accent ? "text-teal-bright" : "text-white/90",
        )}
      >
        {v}
      </div>
    </div>
  );
}

export const FORMAT_LABEL: Record<string, string> = {
  single_elim: "Single elimination",
  double_elim: "Double elimination",
  round_robin: "Round robin",
  league: "League",
};
