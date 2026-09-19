import Link from "next/link";
import { POINT_REASON_LABEL, type PointReason } from "@/lib/friends/points";
import type { FriendPointsSummary } from "@/lib/friends/types";
import { timeAgo } from "@/lib/utils";

/** Friends League — points from friend games & tournaments. Presentational. */
export function FriendsLeagueCard({
  points,
  href = "/play",
}: {
  points: FriendPointsSummary;
  href?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#a78bfa]/30 bg-[linear-gradient(160deg,rgba(167,139,250,0.12),rgba(236,72,153,0.05))] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#c4b5fd]">Friends League</p>
          <p className="mt-2 font-display text-4xl font-bold text-white tabular-nums">
            {points.total}
            <span className="ml-1.5 text-sm font-medium text-mist">pts</span>
          </p>
          <p className="mt-1 text-xs text-mist">
            {points.rank ? `#${points.rank} among friends` : "Play a game to get on the board"}
          </p>
        </div>
        <Link
          href={href}
          className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-medium text-white hover:border-[#a78bfa]/60"
        >
          Play with friends
        </Link>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        {[
          ["Games", points.gamesPlayed],
          ["Wins", points.wins],
          ["Cups won", points.tournamentsWon],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl bg-white/[0.04] py-2.5">
            <dd className="font-display text-lg font-semibold text-white tabular-nums">{value}</dd>
            <dt className="text-[10px] uppercase tracking-wider text-mist">{label}</dt>
          </div>
        ))}
      </dl>

      {points.recent.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-xs">
          {points.recent.map((r, i) => (
            <li key={i} className="flex justify-between text-mist">
              <span>{POINT_REASON_LABEL[r.reason as PointReason] ?? r.reason}</span>
              <span>
                <span className="font-semibold text-[#c4b5fd]">+{r.points}</span> · {timeAgo(r.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[10px] leading-relaxed text-mist/70">
        Friends points come from casual games and friend tournaments. They&apos;re separate from your official
        ranking.
      </p>
    </div>
  );
}
