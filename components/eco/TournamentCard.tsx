"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Countdown } from "./Primitives";
import { cn, formatLKR, formatDayTime } from "@/lib/utils";
import type { OfficialListItem } from "@/lib/friends/types";

/** the badge on a card / the tournament page */
export function officialBadge(t: Pick<OfficialListItem, "status" | "signupClosed">): { label: string; cls: string } {
  if (t.status === "registration_open")
    return t.signupClosed
      ? { label: "Sign-up closed", cls: "bg-white/[0.06] text-mist ring-white/12" }
      : { label: "Sign-up open", cls: "bg-teal/15 text-teal ring-teal/30" };
  if (t.status === "in_progress") return { label: "● Live", cls: "bg-rose-500/15 text-rose-300 ring-rose-400/30" };
  if (t.status === "completed") return { label: "Finished", cls: "bg-white/[0.06] text-mist ring-white/12" };
  return { label: "Cancelled", cls: "bg-white/[0.04] text-mist/60 ring-white/10" };
}

export function TournamentCard({ t, delay = 0 }: { t: OfficialListItem; delay?: number }) {
  const meta = officialBadge(t);
  const fill = Math.round((t.registered / Math.max(1, t.capacity)) * 100);
  const spotsLeft = Math.max(0, t.capacity - t.registered);
  const [mountNow] = useState(() => Date.now());
  const future = !!t.startAt && +new Date(t.startAt) > mountNow;

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ease: [0.16, 1, 0.3, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition-all duration-300 hover:-translate-y-1 hover:border-teal/30 hover:shadow-[0_30px_70px_-40px_rgba(0,194,168,0.4)]"
    >
      <Link href={`/tournaments/${t.slug}`} data-cursor="hot" className="block">
        <div className="relative h-36 overflow-hidden" style={{ background: "linear-gradient(135deg,#0c4a4a,#062231)" }}>
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.4),transparent_40%),radial-gradient(circle_at_80%_60%,rgba(0,194,168,0.4),transparent_45%)]" />
          <div className="absolute inset-0 grid place-items-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[#05090f]/80 font-display text-lg text-white ring-1 ring-white/10">
              {t.status === "completed" ? "🏆" : "8"}
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
          <span className="absolute bottom-3 right-3 max-w-[70%] truncate rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white ring-1 ring-white/10">
            {t.formatLine}
          </span>
        </div>

        <div className="p-5">
          <h3 className="font-display text-lg font-bold text-white">{t.name}</h3>
          {t.summary && <p className="mt-1 line-clamp-2 text-[13px] text-mist">{t.summary}</p>}

          <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
            <Field k="Starts" v={t.startAt ? formatDayTime(t.startAt) : "Date to be announced"} />
            <Field k="Prize pool" v={t.prizePool ? formatLKR(t.prizePool) : "—"} accent />
            <Field k="Entry" v={!t.entryFee ? "Free" : formatLKR(t.entryFee)} />
            <Field k={t.champion ? "Champion" : "Players"} v={t.champion ? t.champion.nickname : `${t.registered}/${t.capacity}`} />
          </div>

          {t.status === "registration_open" && (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-[11px] text-mist">
                <span>
                  {t.registered}/{t.capacity} players
                </span>
                {!t.signupClosed && spotsLeft > 0 && <span className="text-teal">{spotsLeft} places left</span>}
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
          )}

          <div className="mt-4 flex items-center justify-between">
            {t.status === "registration_open" && !t.signupClosed ? (
              <span className="text-xs font-semibold text-teal">Sign up →</span>
            ) : t.status === "in_progress" ? (
              <span className="text-xs font-semibold text-rose-300">Follow the matches →</span>
            ) : t.status === "completed" ? (
              <span className="text-xs text-mist">See the results →</span>
            ) : (
              <span className="text-xs text-mist">Details →</span>
            )}
            {future && t.status === "registration_open" && <Countdown to={t.startAt!} compact />}
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

function Field({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-mist/50">{k}</div>
      <div className={cn("mt-0.5 truncate font-medium", accent ? "text-gold" : "text-white")}>{v}</div>
    </div>
  );
}
