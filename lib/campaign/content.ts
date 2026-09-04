/* ============================================================
   Campaign content — Season 1 "Rise of Precision".

   MOCK CONTENT. 10 chapters × 10 missions = 100 missions,
   generated deterministically at module load. This is the file
   to edit when the real missions are written: change the titles,
   objectives and rival pools below and everything else (XP curve,
   difficulty, boss flags, images) follows.

   Mission *content* lives here rather than in Postgres because it
   is authored, versioned game content. Per-player *progress* lives
   in the database — see lib/campaign/progress.ts.
   ============================================================ */

export type Difficulty = "easy" | "medium" | "hard" | "expert" | "elite";
export type RewardKind = "coins" | "xp" | "item" | "badge";

export interface MissionObjective {
  id: string;
  label: string;
  target: number;
}

export interface MissionReward {
  kind: RewardKind;
  value: string; // "500"  |  "Cue Upgrade"
  label: string; // "Coins" |  "Reward"
  image: string;
}

export interface Rival {
  slug: string;
  name: string;
  rank: number;
  blurb: string;
  image: string;
}

export interface CampaignMission {
  id: string; // "m-003"
  number: number; // 1..100
  chapter: number; // 1..10
  indexInChapter: number; // 1..10
  title: string;
  summary: string;
  difficulty: Difficulty;
  isBoss: boolean;
  xp: number;
  coins: number;
  /** The artwork this mission *wants*, named per the asset brief. */
  image: string;
  /** Shipped artwork used until `image` exists. Never a missing file. */
  artwork: string;
  /** object-position for the crop, so reused artwork doesn't look repetitive. */
  focus: string;
  objectives: MissionObjective[];
  rewards: MissionReward[];
  rival: Rival | null;
}

export interface CampaignChapter {
  number: number;
  name: string;
  tagline: string;
  accent: string; // per-chapter visual identity, stays in the teal→gold family
  image: string;
  artwork: string;
  focus: string;
}

/* ---- shipped artwork ------------------------------------------------
   Every image here exists in public/assets/campaign. Missions and chapters
   are dealt one of these so the campaign is fully art-directed today, and
   each still points `image` at the filename from the asset brief — drop that
   file in and it takes over automatically, no code change. */

export const ARTWORK = {
  rack: "/assets/campaign/mission-01-break.jpg", // racked balls, warm lamps (portrait)
  parlour: "/assets/campaign/mission-02-angles.jpg", // full parlour interior
  table: "/assets/campaign/mission-04-control.jpg", // lone table on black (moody)
  trophy: "/assets/campaign/campaign-main-bg.jpg", // table + trophy + brackets
  eightBall: "/assets/campaign/season-1-rise-of-precision.jpg", // 8-ball + cue
  /** Branded venue shot — logo + "MORE THAN JUST A GAME" wall. Portrait, so
   *  it is the one to use for full-bleed phone-shaped heroes. */
  venue: "/assets/campaign/venue-hero.jpg",
  /** 8-ball on felt with deep negative space on the left — built for section
   *  cards where copy sits left and the subject sits right. */
  felt: "/assets/campaign/felt-8ball.jpg",
} as const;

/** Crops, so the same five images never read as the same picture twice. */
const FOCUS = ["50% 50%", "50% 35%", "40% 60%", "60% 45%", "50% 70%", "35% 50%"];

/** Boss missions get the trophy shot, rivals the moody table, the rest cycle. */
function artworkFor(number: number, isBoss: boolean, hasRival: boolean): string {
  if (isBoss) return ARTWORK.trophy;
  if (hasRival) return ARTWORK.table;
  const cycle = [
    ARTWORK.rack,
    ARTWORK.felt,
    ARTWORK.parlour,
    ARTWORK.eightBall,
    ARTWORK.venue,
    ARTWORK.table,
  ];
  return cycle[number % cycle.length];
}

export const SEASON = {
  number: 1,
  name: "Rise of Precision",
  tagline: "Rise through the ranks. Prove your precision.",
  pillars: ["Challenge", "Improve", "Earn", "Be recognized"],
  image: "/assets/campaign/season-1-rise-of-precision.jpg",
  background: "/assets/campaign/campaign-main-bg.jpg",
} as const;

export const STARS_PER_MISSION = 3;

/* ---- chapters ------------------------------------------------------ */

const CHAPTER_DEFS: [name: string, tagline: string, accent: string][] = [
  ["The Break", "Learn the basics, build your control and take your first steps towards becoming a Cue Point player.", "#00c2a8"],
  ["Find Your Angle", "Cut shots, ghost balls and the geometry that turns a lucky pot into a repeatable one.", "#10d6c0"],
  ["Cue Ball Control", "Stop, follow, draw. Stop chasing the object ball and start placing the white.", "#2af0d6"],
  ["Banks & Rails", "Learn the diamonds, read the rails and find the pocket the long way round.", "#2fe3ee"],
  ["Tactical Player", "Safeties, snookers and knowing when not to pot. Win the frames you shouldn't.", "#35d2f5"],
  ["Run the Table", "Pattern play and position from the break to the 8. Clear it in one visit.", "#43bff7"],
  ["Rival Road", "Head-to-head against the room's regulars. Every frame is personal now.", "#57abf2"],
  ["Tournament Pressure", "Brackets, clocks and a crowd. Hold your stroke when it counts.", "#6e9bea"],
  ["Elite Pool", "Century breaks, precision safeties and the shots that separate the top table.", "#e0c173"],
  ["Road to #1", "Ten frames stand between you and the top of the Cue Point board.", "#f4c430"],
];

const CHAPTER_SLUGS = [
  "break", "angles", "control", "banks", "tactical",
  "runout", "rivals", "pressure", "elite", "number-one",
];

const CHAPTER_ARTWORK = [
  ARTWORK.venue, // The Break — open on the branded room
  ARTWORK.felt,
  ARTWORK.eightBall,
  ARTWORK.table,
  ARTWORK.parlour,
  ARTWORK.rack,
  ARTWORK.table,
  ARTWORK.venue,
  ARTWORK.eightBall,
  ARTWORK.trophy, // Road to #1 — the trophy shot closes the season
];

export const CHAPTERS: CampaignChapter[] = CHAPTER_DEFS.map(
  ([name, tagline, accent], i) => ({
    number: i + 1,
    name,
    tagline,
    accent,
    image: `/assets/campaign/chapter-${pad(i + 1)}-${CHAPTER_SLUGS[i]}.jpg`,
    artwork: CHAPTER_ARTWORK[i],
    focus: FOCUS[i % FOCUS.length],
  }),
);

/* The five artwork files named in the brief. Everything past mission 5 uses
   a generated `mission-<nn>-<slug>.jpg` name and shows the missing-asset
   placeholder until the file exists. */
const MISSION_IMAGE_OVERRIDES: Record<number, string> = {
  1: "/assets/campaign/mission-01-break.jpg",
  2: "/assets/campaign/mission-02-angles.jpg",
  3: "/assets/campaign/mission-03-precision.jpg",
  4: "/assets/campaign/mission-04-control.jpg",
  5: "/assets/campaign/mission-05-rival.jpg",
};

/* ---- XP curve ------------------------------------------------------
   Per chapter [first mission XP, boss XP]. Missions inside a chapter
   interpolate between the two, so mission 1 pays 25 XP and mission 100
   (the final boss) pays 1,500. Early missions are deliberately cheap so
   the opening chapter can't be farmed. */

const CHAPTER_XP: [number, number][] = [
  [25, 60],
  [70, 130],
  [140, 220],
  [230, 330],
  [340, 460],
  [470, 620],
  [630, 800],
  [810, 1000],
  [1010, 1230],
  [1250, 1500],
];

const CHAPTER_DIFFICULTY: [base: Difficulty, boss: Difficulty][] = [
  ["easy", "medium"],
  ["easy", "medium"],
  ["medium", "hard"],
  ["medium", "hard"],
  ["hard", "hard"],
  ["hard", "expert"],
  ["hard", "expert"],
  ["expert", "expert"],
  ["expert", "elite"],
  ["elite", "elite"],
];

/* ---- mission titles (mock) ----------------------------------------- */

const TITLES: string[][] = [
  ["First Rack", "Clean Contact", "Precision Break", "Straight Talk", "Pocket Sense", "Cue Grip", "The Long Pot", "Two In A Row", "No Scratch", "Rookie Test"],
  ["Cut It Fine", "Ghost Ball", "Thin Edge", "Half Ball", "Angle Hunt", "Corner Logic", "Side Pocket", "The Overcut", "Tight Cuts", "Angle Master"],
  ["Dead Stop", "Follow Through", "Draw Back", "Soft Touch", "Centre Ball", "Speed Control", "Two Rail Shape", "Stun Run", "White Discipline", "Control Test"],
  ["First Bank", "Diamond System", "Off Two Rails", "Kick Safe", "Rail Cut", "Long Bank", "Three Rails", "Pocket Speed", "Bank Under Pressure", "Rail Boss"],
  ["Hide The White", "Full Snooker", "Safe Exchange", "Roll Up", "Read The Table", "Deny The Pot", "Foul Bait", "Two Way Shot", "Lock It Down", "Tactician"],
  ["Read The Pattern", "Key Ball", "Break And Run", "Clear The Cluster", "Insurance Ball", "Table Length", "One Visit", "Run Of Five", "Perfect Position", "Run Out King"],
  ["Meet The Hustler", "The Regular", "Grudge Frame", "Race To Three", "Bar Table Rules", "Rematch", "Trash Talk", "Money Frame", "Decider", "Rival Slayer"],
  ["First Round", "Shot Clock", "Group Stage", "Quarter Final", "Crowd Noise", "Semi Final", "Sudden Death", "Hill Hill", "The Final", "Trophy Lift"],
  ["Century Break", "Precision Safety", "Nine On The Snap", "No Miss Frame", "Long Game", "Perfect Break", "Straight Pool", "Clutch Pot", "Flawless Visit", "Elite Test"],
  ["Top Sixteen", "Top Eight", "The Contender", "House Champion", "Unbeaten Run", "Title Shot", "Championship Frame", "Last Rival", "Match Point", "Who Is #1?"],
];

/* ---- objective pools (mock) ---------------------------------------- */

const OBJECTIVE_POOL: [label: string, target: number][][] = [
  [["Pot {n} balls", 3], ["Win without scratching", 1], ["Break and pot", 1], ["Finish in {n} shots or less", 12], ["Pot the 8-ball on call", 1]],
  [["Pot {n} cut shots", 3], ["Pot into a side pocket", 2], ["Win without a foul", 1], ["Pot from distance", 2], ["Finish in {n} shots or less", 14]],
  [["Play {n} stop shots", 3], ["Use draw to get shape", 2], ["Win without touching a rail", 1], ["Pot {n} balls in one visit", 3], ["Leave the white centre table", 2]],
  [["Pot {n} bank shots", 2], ["Pot off two rails", 1], ["Escape a snooker", 2], ["Win using a rail cut", 1], ["Finish in {n} shots or less", 16]],
  [["Play {n} safeties", 3], ["Snooker your opponent", 2], ["Force a foul", 1], ["Win a tactical frame", 1], ["Keep the white safe {n} times", 3]],
  [["Clear {n} balls in one visit", 5], ["Break and run the table", 1], ["Split the cluster", 1], ["Win in a single visit", 1], ["Pot {n} balls without a miss", 6]],
  [["Beat your rival", 1], ["Win {n} frames", 2], ["Win the decider", 1], ["Take a frame on the black", 1], ["Win without conceding a visit", 1]],
  [["Win a bracket match", 1], ["Beat the shot clock", 3], ["Win {n} frames in a row", 2], ["Reach the final", 1], ["Win from behind", 1]],
  [["Record a {n}+ break", 40], ["Win a flawless frame", 1], ["Pot {n} balls without a foul", 8], ["Win against a top-10 player", 1], ["Clear from the break", 1]],
  [["Beat a top-{n} player", 16], ["Win the title frame", 1], ["Hold the #1 spot", 1], ["Win {n} matches", 3], ["Finish the campaign", 1]],
];

/* ---- rivals (mock) -------------------------------------------------- */

const RIVAL_POOL: [name: string, blurb: string, slug: string][] = [
  ["The Hustler", "A fearless competitor with unpredictable tactics.", "hustler"],
  ["8BallNinja", "Silent, patient, and lethal on the long pot.", "ninja"],
  ["BankShotPro", "Reads the diamonds like a map. Never takes the easy route.", "bankshot"],
  ["CueQueen", "Position play so tidy it looks rehearsed.", "cuequeen"],
  ["SmoothStroke", "Never rushes, never misses the shot that matters.", "smooth"],
  ["MrPocket", "Pots from anywhere. Struggles when snookered.", "mrpocket"],
  ["The Professor", "Plays the percentages and waits for your mistake.", "professor"],
  ["MissCue", "Aggressive breaker with a devastating run-out game.", "misscue"],
  ["IronWrist", "Tournament hardened. Thrives on the hill.", "ironwrist"],
  ["CueMaster", "The name at the top of the board. Beat him and it's yours.", "cuemaster"],
];

/* ---- generation ----------------------------------------------------- */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function buildMission(chapter: number, indexInChapter: number): CampaignMission {
  const number = (chapter - 1) * 10 + indexInChapter;
  const isBoss = indexInChapter === 10;
  const c = chapter - 1;

  const [startXp, bossXp] = CHAPTER_XP[c];
  const xp = isBoss
    ? bossXp
    : round5(startXp + ((bossXp - startXp) * (indexInChapter - 1)) / 9);

  const [base, boss] = CHAPTER_DIFFICULTY[c];
  const difficulty = isBoss ? boss : base;

  const title = TITLES[c][indexInChapter - 1];
  const pool = OBJECTIVE_POOL[c];

  // 3 objectives normally, 4 on boss missions — picked deterministically so
  // the same mission always shows the same checklist.
  const count = isBoss ? 4 : 3;
  const objectives: MissionObjective[] = Array.from({ length: count }, (_, i) => {
    const [label, target] = pool[(indexInChapter - 1 + i) % pool.length];
    return {
      id: `m-${pad3(number)}-o${i + 1}`,
      label: label.replace("{n}", String(target)),
      target,
    };
  });

  const coins = round10(xp * (isBoss ? 4 : 2));

  const rewards: MissionReward[] = [
    { kind: "coins", value: String(coins), label: "Coins", image: "/assets/campaign/cuepoint-coin.png" },
    { kind: "xp", value: String(xp), label: "XP", image: "/assets/campaign/xp-icon.png" },
  ];
  if (isBoss) {
    rewards.push(
      { kind: "item", value: "Cue Upgrade", label: "Item", image: "/assets/campaign/cue-upgrade.png" },
      { kind: "badge", value: `${CHAPTER_DEFS[c][0]} Badge`, label: "Badge", image: "/assets/campaign/campaign-badge.png" },
    );
  } else if (number % 5 === 0) {
    rewards.push({ kind: "badge", value: "Campaign Badge", label: "Badge", image: "/assets/campaign/campaign-badge.png" });
  }

  // a rival every 5th mission, ranked closer to #1 as the campaign goes on
  let rival: Rival | null = null;
  if (number % 5 === 0) {
    const r = RIVAL_POOL[((number / 5 - 1) % RIVAL_POOL.length + RIVAL_POOL.length) % RIVAL_POOL.length];
    rival = {
      slug: r[2],
      name: r[0],
      blurb: r[1],
      rank: Math.max(1, 20 - Math.floor(number / 5)),
      image: `/assets/campaign/rival-${r[2]}.png`,
    };
  }

  return {
    id: `m-${pad3(number)}`,
    number,
    chapter,
    indexInChapter,
    title,
    summary: SUMMARIES[c][indexInChapter - 1] ?? CHAPTER_DEFS[c][1],
    difficulty,
    isBoss,
    xp,
    coins,
    image:
      MISSION_IMAGE_OVERRIDES[number] ??
      `/assets/campaign/mission-${pad(number)}-${slugify(title)}.jpg`,
    artwork: artworkFor(number, isBoss, number % 5 === 0),
    focus: FOCUS[number % FOCUS.length],
    objectives,
    rewards,
    rival,
  };
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

function round10(n: number): number {
  return Math.round(n / 10) * 10;
}

/* Short mission blurbs. Only chapter 1 is written out — the rest fall back
   to the chapter tagline until the real copy lands. */
const SUMMARIES: string[][] = [
  [
    "Rack them tight and take your first shot at Cue Point. Everything starts here.",
    "Strike the cue ball clean through the centre. No swerve, no jump, no excuses.",
    "A solid break sets the tone. Pot the required balls and take control of the table.",
    "Straight pots look easy until they aren't. Line up and deliver.",
    "Pick your pocket before you strike. Commit to the call.",
    "Grip, bridge, stance. Build the stroke you'll use for the next 99 missions.",
    "Full table length, one ball, one pocket. Trust the line.",
    "Two pots in a single visit. Stay down and stay on the shot.",
    "Win the frame without putting the white in a pocket. Discipline over power.",
    "The chapter boss. Clear every objective and unlock Find Your Angle.",
  ],
  [], [], [], [], [], [], [], [], [],
];

export const MISSIONS: CampaignMission[] = CHAPTERS.flatMap((c) =>
  Array.from({ length: 10 }, (_, i) => buildMission(c.number, i + 1)),
);

export const TOTAL_MISSIONS = MISSIONS.length;
export const TOTAL_STARS = TOTAL_MISSIONS * STARS_PER_MISSION;

const BY_ID = new Map(MISSIONS.map((m) => [m.id, m]));

export function getMission(id: string): CampaignMission | undefined {
  return BY_ID.get(id);
}

export function missionsInChapter(chapter: number): CampaignMission[] {
  return MISSIONS.filter((m) => m.chapter === chapter);
}

export function getChapter(n: number): CampaignChapter | undefined {
  return CHAPTERS[n - 1];
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
  elite: "Elite",
};

/** Tailwind-friendly colour per difficulty — muted teal up to a hot red. */
export const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: "#4ade80",
  medium: "#2af0d6",
  hard: "#fb7185",
  expert: "#f97316",
  elite: "#f4c430",
};
