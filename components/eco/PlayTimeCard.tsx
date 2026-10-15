import Link from "next/link";
import {
  FREE_EVERY_MIN,
  FREE_REWARD_MIN,
  formatMinutes,
  type PlayTimeSummary,
} from "@/lib/playtime";

/** Playing hours + free-time balance. Presentational. */
export function PlayTimeCard({ playTime }: { playTime: PlayTimeSummary }) {
  const progress = FREE_EVERY_MIN - playTime.toNextFreeMin;
  const pct = Math.round((progress / FREE_EVERY_MIN) * 100);
  return (
    <div className="rounded-2xl border border-teal/30 bg-[linear-gradient(160deg,rgba(45,212,191,0.10),rgba(45,212,191,0.02))] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-teal">Playing hours</p>
          <p className="mt-2 font-display text-4xl font-bold text-white tabular-nums">
            {formatMinutes(playTime.paidMin)}
          </p>
          <p className="mt-1 text-xs text-mist">
            Every {FREE_EVERY_MIN / 60} hours you play earns {FREE_REWARD_MIN} minutes free
          </p>
        </div>
        <Link
          href="/book"
          className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-medium text-white hover:border-teal/60"
        >
          Book a table
        </Link>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        {[
          ["Free time ready", formatMinutes(playTime.freeBalance)],
          ["Earned", formatMinutes(playTime.freeEarned)],
          ["Used", formatMinutes(playTime.freeUsed)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white/[0.04] py-2.5">
            <dd className="font-display text-lg font-semibold text-white tabular-nums">{value}</dd>
            <dt className="text-[10px] uppercase tracking-wider text-mist">{label}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-4">
        <div className="flex justify-between text-[11px] text-mist">
          <span>Next free {FREE_REWARD_MIN} min</span>
          <span>{formatMinutes(playTime.toNextFreeMin)} to go</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-mist/70">
        Your bookings count once the slot has finished. Ask at the counter to use free time on your
        next session.
      </p>
    </div>
  );
}
