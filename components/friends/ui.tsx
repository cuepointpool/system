"use client";

import { PlayerAvatar } from "@/components/eco/Primitives";
import { cn } from "@/lib/utils";
import type {
  GameStatus,
  MemberView,
  PlayerRef,
  TournamentStatus,
} from "@/lib/friends/types";

/* Friends accent — violet → pink, deliberately not the teal brand colour or
   Campaign's gold, so the feature reads as its own thing. */
export const ACCENT_TEXT = "text-[#c4b5fd]";
export const ACCENT_GRADIENT = "bg-[linear-gradient(120deg,#a78bfa,#ec4899)]";

const GAME_LABEL: Record<GameStatus, string> = {
  waiting_for_players: "Waiting for players",
  ready: "Ready",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TOURNAMENT_LABEL: Record<TournamentStatus, string> = {
  registration_open: "Registration open",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TONE: Record<string, string> = {
  waiting_for_players: "border-white/15 bg-white/[0.04] text-mist",
  registration_open: "border-white/15 bg-white/[0.04] text-mist",
  ready: "border-teal/40 bg-teal/10 text-teal",
  full: "border-teal/40 bg-teal/10 text-teal",
  in_progress: "border-[#ffb066]/40 bg-[#ff9d3d]/10 text-[#ffb066]",
  completed: "border-[#a78bfa]/40 bg-[#a78bfa]/10 text-[#c4b5fd]",
  cancelled: "border-red-400/30 bg-red-400/10 text-red-300",
};

export function StatusPill({
  status,
  kind,
  full,
}: {
  status: GameStatus | TournamentStatus;
  kind: "game" | "tournament";
  /** tournament with every place filled — shown as "Full · ready" */
  full?: boolean;
}) {
  const label =
    kind === "game"
      ? GAME_LABEL[status as GameStatus]
      : full && status === "registration_open"
        ? "Full · ready to start"
        : TOURNAMENT_LABEL[status as TournamentStatus];
  const tone = full && status === "registration_open" ? TONE.full : TONE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        tone,
      )}
    >
      {label}
    </span>
  );
}

/** "Players 3/4" with a fill bar */
export function CountBar({
  label,
  have,
  need,
  tone = "accent",
}: {
  label: string;
  have: number;
  need: number;
  tone?: "accent" | "teal";
}) {
  const pct = need ? Math.min(100, Math.round((have / need) * 100)) : 0;
  const over = have > need;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-mist">{label}</span>
        <span
          className={cn(
            "font-display font-semibold tabular-nums",
            over ? "text-red-300" : have === need ? "text-teal" : "text-white",
          )}
        >
          {have}/{need}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            over ? "bg-red-400" : tone === "teal" ? "bg-teal" : ACCENT_GRADIENT,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function MemberBadge({ status }: { status: MemberView["status"] }) {
  return status === "accepted" ? (
    <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-semibold text-teal">
      Accepted
    </span>
  ) : (
    <span className="rounded-full bg-[#ff9d3d]/15 px-2 py-0.5 text-[10px] font-semibold text-[#ffb066]">
      Invited
    </span>
  );
}

export function PlayerLine({
  player,
  status,
  right,
  you,
}: {
  player: PlayerRef;
  status?: MemberView["status"];
  right?: React.ReactNode;
  you?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <PlayerAvatar name={player.nickname} src={player.avatar} size="xs" />
      <span className="min-w-0 flex-1 truncate text-sm text-white">
        {player.nickname}
        {you && <span className="ml-1.5 text-[11px] text-mist">(you)</span>}
      </span>
      {status && <MemberBadge status={status} />}
      {right}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-white/10 bg-white/[0.025] p-5", className)}>
      {children}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "ok" | "warn" | "error";
  children: React.ReactNode;
}) {
  const cls = {
    info: "border-white/10 bg-white/[0.03] text-mist",
    ok: "border-teal/30 bg-teal/[0.07] text-teal",
    warn: "border-[#ffb066]/35 bg-[#ff9d3d]/[0.08] text-[#ffc98f]",
    error: "border-red-400/35 bg-red-400/[0.08] text-red-300",
  }[tone];
  return (
    <p role={tone === "error" ? "alert" : undefined} className={cn("rounded-xl border px-4 py-3 text-sm", cls)}>
      {children}
    </p>
  );
}

export function PrimaryButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(
        "rounded-full px-5 py-2.5 text-sm font-semibold text-navy-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40",
        ACCENT_GRADIENT,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  danger,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      {...rest}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        danger
          ? "border-red-400/30 text-red-300 hover:bg-red-400/10"
          : "border-white/15 text-white hover:border-[#a78bfa]/60 hover:bg-[#a78bfa]/10",
        className,
      )}
    >
      {children}
    </button>
  );
}

export const FORMAT_SHORT: Record<string, string> = { "1v1": "1v1", "2v2": "2v2" };
