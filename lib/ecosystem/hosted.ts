/* ============================================================
   Cue Point-hosted tournaments — round names and match length.
   Client-safe (the admin form, the public bracket and the server
   all need the same round names).
   ============================================================ */

import { BEST_OF_OPTIONS, type BestOf } from "../friends/structure";

/** "Final", "Semi Final", "Quarter Final", "Round 1" … for a bracket of `totalRounds` */
export function hostedRoundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round; // 0 = final
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi Final";
  if (fromEnd === 2) return "Quarter Final";
  return `Round ${round}`;
}

/** the rounds a bracket of `size` players has, first to last */
export function hostedRounds(size: number): string[] {
  const total = Math.max(1, Math.round(Math.log2(Math.max(2, size))));
  return Array.from({ length: total }, (_, i) => hostedRoundLabel(i + 1, total));
}

/** keep only known lengths for known-looking round names */
export function normalizeHostedBestOf(raw: unknown): Record<string, BestOf> {
  const out: Record<string, BestOf> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (k.length <= 30 && (BEST_OF_OPTIONS as readonly number[]).includes(n)) out[k] = n as BestOf;
  }
  return out;
}
