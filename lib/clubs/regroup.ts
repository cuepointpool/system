/* ============================================================
   Club weekly regrouping — pure logic (no database), tested by
   `npm run test:clubs`.

   Groups are ranked: group 1 is the top ("Pro") group. Each week every
   group plays its own league. Afterwards, at every boundary between two
   neighbouring groups, the bottom K of the upper group move down and the
   top K of the lower group move up. K = the club's move count, or (when
   not set) half of the smaller of the two groups — so with two groups of
   8, the new Pro group is the top 4 of Pro + the top 4 of group 2, and the
   new group 2 is the bottom 4 of both.

   Members who didn't play that week (joined late, sat out) stay where
   they are. A group that didn't play that week (empty or too small) is
   skipped: its neighbours above and below swap players with each other.
   ============================================================ */

export interface GroupWeek {
  group: number;
  /** current members of this group */
  members: string[];
  /** finishing order of this week's league, best first; null = group didn't play */
  order: string[] | null;
}

export interface Move {
  playerId: string;
  from: number;
  to: number;
}

/** how many cross one boundary, given both groups' sizes this week */
export function movesAcross(upperSize: number, lowerSize: number, moveCount: number | null): number {
  const half = Math.floor(Math.min(upperSize, lowerSize) / 2);
  if (moveCount == null) return half;
  // never more than half of either group: a middle group can then never
  // send the same player both up and down
  return Math.max(0, Math.min(moveCount, Math.floor(upperSize / 2), Math.floor(lowerSize / 2)));
}

export function planMoves(groups: GroupWeek[], moveCount: number | null): Move[] {
  // only groups that played this week; a group that sat out is stepped over
  const sorted = [...groups].sort((a, b) => a.group - b.group).filter((g) => g.order);
  const moves: Move[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const up = sorted[i];
    const down = sorted[i + 1];
    if (!up.order || !down.order) continue;
    // only players still in that group count (someone may have left the club)
    const upOrder = up.order.filter((p) => up.members.includes(p));
    const downOrder = down.order.filter((p) => down.members.includes(p));
    const k = movesAcross(upOrder.length, downOrder.length, moveCount);
    if (!k) continue;
    for (const p of upOrder.slice(-k)) moves.push({ playerId: p, from: up.group, to: down.group });
    for (const p of downOrder.slice(0, k)) moves.push({ playerId: p, from: down.group, to: up.group });
  }
  return moves;
}

/** default group names: 1 = "Pro", then "Group 2", "Group 3", … */
export function groupLabel(names: string[], group: number): string {
  if (group === 0) return "Club final";
  const n = (names[group - 1] ?? "").trim();
  if (n) return n;
  return group === 1 ? "Pro" : `Group ${group}`;
}

export const MAX_CLUB_GROUPS = 12;
