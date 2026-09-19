/* ============================================================
   Single-elimination bracket generation — pure, no I/O.

   One algorithm for every size: pad the entrant count up to the next
   power of two, lay the seeds out in standard bracket order, and turn
   every seed beyond the real entrant count into a BYE. A BYE is just
   a first-round game with one empty slot; its lone team advances.

   Input is the entrants ALREADY IN SEED ORDER (seed 1 first) — the
   caller decides random vs ranking. Works for players (1v1) and
   teams (2v2) alike because entrants are opaque.
   ============================================================ */

export interface BracketSlotRef {
  round: number;
  position: number;
  slot: "a" | "b";
}

export interface BracketGame<T> {
  /** 1-based; round 1 is the first played round */
  round: number;
  /** 0-based within the round */
  position: number;
  /** filled for round 1 only; later rounds start empty (null) */
  a: T | null;
  b: T | null;
  /** round-1 game with exactly one entrant: that entrant advances unplayed */
  isBye: boolean;
  next: BracketSlotRef | null;
}

export interface Bracket<T> {
  size: number;
  rounds: number;
  byes: number;
  games: BracketGame<T>[];
}

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Seed numbers in bracket-slot order: [1,8,4,5,2,7,3,6] for 8. Adjacent
 * pairs are the round-1 games, and the top seeds can only meet late.
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

/** "Final", "Semi Finals", "Quarter Finals", "Round of 16"… */
export function roundName(round: number, totalRounds: number): string {
  const remaining = totalRounds - round + 1;
  if (remaining === 1) return "Final";
  if (remaining === 2) return "Semi Finals";
  if (remaining === 3) return "Quarter Finals";
  return `Round of ${2 ** remaining}`;
}

export function generateBracket<T>(seeded: T[]): Bracket<T> {
  const n = seeded.length;
  if (n < 2) throw new Error("A bracket needs at least 2 entrants.");
  const size = nextPow2(n);
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const games: BracketGame<T>[] = [];

  for (let round = 1; round <= rounds; round++) {
    const count = size / 2 ** round;
    for (let position = 0; position < count; position++) {
      let a: T | null = null;
      let b: T | null = null;
      if (round === 1) {
        const sa = order[position * 2];
        const sb = order[position * 2 + 1];
        a = sa <= n ? seeded[sa - 1] : null;
        b = sb <= n ? seeded[sb - 1] : null;
      }
      games.push({
        round,
        position,
        a,
        b,
        isBye: round === 1 && (a === null) !== (b === null),
        next:
          round < rounds
            ? {
                round: round + 1,
                position: Math.floor(position / 2),
                slot: position % 2 === 0 ? "a" : "b",
              }
            : null,
      });
    }
  }
  return { size, rounds, byes: size - n, games };
}
