"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { PlayerAvatar, Tabs } from "./Primitives";
import { cn } from "@/lib/utils";
import type { BracketMatch, PlayerLite } from "@/lib/ecosystem/types";

type PMap = Record<string, PlayerLite>;

const NODE_H = 72;
const BASE_GAP = 18;

export function BracketView({
  bracket,
  players,
  championId,
}: {
  bracket: BracketMatch[];
  players: PMap;
  championId: string | null;
}) {
  const rounds = groupRounds(bracket);
  if (!rounds.length)
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-mist">
        The bracket will be generated once registration closes.
      </p>
    );

  return (
    <>
      {/* desktop / tablet — horizontal bracket */}
      <div className="hide-scrollbar hidden overflow-x-auto pb-2 md:block">
        <div className="flex min-w-[720px] gap-6">
          {rounds.map((r, ri) => {
            const margin = roundMargin(ri);
            return (
              <div
                key={ri}
                className="flex min-w-[200px] flex-1 flex-col justify-center"
              >
                <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-teal">
                  {r[0]?.roundName ?? `Round ${ri + 1}`}
                </div>
                {r.map((m, mi) => (
                  <div
                    key={m.id}
                    className="relative"
                    style={{ marginTop: margin, marginBottom: margin }}
                  >
                    <MatchNode m={m} players={players} />
                    {ri < rounds.length - 1 && (
                      <Connectors roundIndex={ri} isOdd={mi % 2 === 0} />
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          {/* champion column */}
          <div className="flex min-w-[160px] flex-col justify-center">
            <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-bright">
              Champion
            </div>
            <ChampionNode player={championId ? players[championId] : null} />
          </div>
        </div>
      </div>

      {/* mobile — round tabs */}
      <MobileBracket rounds={rounds} players={players} championId={championId} />
    </>
  );
}

function MobileBracket({
  rounds,
  players,
  championId,
}: {
  rounds: BracketMatch[][];
  players: PMap;
  championId: string | null;
}) {
  const tabs = [
    ...rounds.map((r, i) => ({
      value: String(i),
      label: r[0]?.roundName ?? `R${i + 1}`,
    })),
    { value: "champ", label: "Champion" },
  ];
  const [tab, setTab] = useState("0");

  return (
    <div className="md:hidden">
      <Tabs tabs={tabs} value={tab} onChange={setTab} size="sm" layoutId="bkt-mob" />
      <div className="relative mt-4 min-h-[240px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            {tab === "champ" ? (
              <ChampionNode player={championId ? players[championId] : null} />
            ) : (
              rounds[Number(tab)].map((m) => (
                <MatchNode key={m.id} m={m} players={players} expanded />
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function MatchNode({
  m,
  players,
  expanded = false,
}: {
  m: BracketMatch;
  players: PMap;
  expanded?: boolean;
}) {
  const a = m.aId ? players[m.aId] : null;
  const b = m.bId ? players[m.bId] : null;
  const done = !!m.winnerId;

  return (
    <motion.div
      layout
      className={cn(
        "overflow-hidden rounded-xl border bg-navy-900/80",
        done ? "border-teal/20" : "border-white/10",
        expanded ? "" : "min-h-[72px]",
      )}
    >
      <div className="divide-y divide-white/8">
        <NodeLine p={a} score={m.scoreA} isWinner={m.winnerId === m.aId && !!m.aId} />
        <NodeLine p={b} score={m.scoreB} isWinner={m.winnerId === m.bId && !!m.bId} />
      </div>
      {expanded && (
        <div className="flex items-center justify-between border-t border-white/8 px-2.5 py-1.5 text-[10px] text-mist/60">
          <span>{m.tableName ?? "Table TBD"}</span>
          <span>{done ? "Final" : "Scheduled"}</span>
        </div>
      )}
    </motion.div>
  );
}

function NodeLine({
  p,
  score,
  isWinner,
}: {
  p: PlayerLite | null;
  score: number | null;
  isWinner: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-2.5 py-1.5",
        isWinner ? "bg-teal/10" : "",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {p ? (
          <>
            <PlayerAvatar name={p.fullName} src={p.avatar} size="xs" />
            <Link
              href={`/players/${p.slug}`}
              className={cn(
                "truncate text-[12px]",
                isWinner ? "font-semibold text-white" : "text-mist",
              )}
            >
              {p.nickname}
            </Link>
          </>
        ) : (
          <span className="text-[12px] text-mist/40">TBD</span>
        )}
      </span>
      <span
        className={cn(
          "font-display text-sm tabular-nums",
          isWinner ? "text-teal-bright" : "text-mist/60",
        )}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}

function ChampionNode({ player }: { player: PlayerLite | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
      className={cn(
        "rounded-xl border p-4 text-center",
        player
          ? "border-teal-bright/40 bg-[linear-gradient(160deg,rgba(42,240,214,0.16),rgba(5,16,28,0.5))] shadow-[0_20px_50px_-24px_rgba(42,240,214,0.5)]"
          : "border-dashed border-white/15 bg-white/[0.02]",
      )}
    >
      {player ? (
        <>
          <span className="text-lg" aria-hidden>
            🏆
          </span>
          <div className="mx-auto mt-1">
            <PlayerAvatar name={player.fullName} src={player.avatar} size="md" ring className="mx-auto" />
          </div>
          <Link
            href={`/players/${player.slug}`}
            className="mt-2 block font-display text-sm font-bold text-white"
          >
            {player.nickname}
          </Link>
          <div className="text-[10px] text-mist">Tournament winner</div>
        </>
      ) : (
        <div className="py-4 text-[11px] text-mist/50">
          To be decided
        </div>
      )}
    </motion.div>
  );
}

/* connector lines between rounds (approx, works for 8-player single-elim) */
function Connectors({ roundIndex, isOdd }: { roundIndex: number; isOdd: boolean }) {
  const m = roundMargin(roundIndex);
  const half = NODE_H / 2 + m;
  return (
    <>
      <span
        className="pointer-events-none absolute right-[-24px] top-1/2 h-[2px] w-6 bg-white/12"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute right-[-24px] w-[2px] bg-white/12"
        style={
          isOdd
            ? { top: "50%", height: half }
            : { bottom: "50%", height: half }
        }
        aria-hidden
      />
      {isOdd && (
        <span
          className="pointer-events-none absolute right-[-24px] h-[2px] w-6 bg-white/12"
          style={{ top: `calc(50% + ${half}px)` }}
          aria-hidden
        />
      )}
    </>
  );
}

function roundMargin(roundIndex: number): number {
  return ((2 ** roundIndex - 1) * (NODE_H + BASE_GAP)) / 2 + BASE_GAP / 2;
}

function groupRounds(bracket: BracketMatch[]): BracketMatch[][] {
  const byRound = new Map<number, BracketMatch[]>();
  for (const m of bracket) {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round)!.push(m);
  }
  return [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, list]) => list.sort((x, y) => x.position - y.position));
}
