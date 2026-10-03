import Link from "next/link";
import { Reveal } from "./Reveal";

const VIOLET = "#a78bfa";
const PINK = "#ec4899";

const STEPS = [
  {
    n: "1",
    title: "Pick your format",
    body: "1v1 singles or 2v2 doubles, 8-Ball on our 9ft tables. The app tells you exactly how many players you need.",
    diagram: <FormatDiagram />,
  },
  {
    n: "2",
    title: "Add your friends",
    body: "Search registered players and invite them. They accept from their own account. Not registered? Add them to a tournament as a guest by name.",
    diagram: <InviteDiagram />,
  },
  {
    n: "3",
    title: "The bracket builds itself",
    body: "Any number from 3 to 32 entries. Uneven numbers get automatic BYEs. Report results and winners advance live on every phone.",
    diagram: <BracketDiagram />,
  },
];

const PERKS = [
  "Private to the friends you add",
  "Live updates, no refreshing",
  "Friends League points on your profile",
] as const;

export function FriendsPlay() {
  return (
    <section id="friends" className="py-20 sm:py-28">
      <div className="px-5 md:px-8 lg:px-12">
        <Reveal>
          <span className="text-xs font-medium uppercase tracking-[0.32em] text-[#c4b5fd]">
            New · Friends tournaments
          </span>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <h2 className="font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl md:text-5xl xl:whitespace-nowrap">
              Create your own tournament{" "}
              <span className="text-[#c4b5fd]">with friends</span>
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-mist lg:pb-1 lg:text-right">
              Set up a 1v1 or 2v2 game or a full knockout, add your friends and
              play it out on one table. Book a second if the group needs it.
            </p>
          </div>
        </Reveal>

        <ol className="mt-12 grid gap-x-4 gap-y-10 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} as="li" delay={0.07 * i}>
              <div className="flex h-56 items-center justify-center rounded-lg bg-navy-900 p-5 sm:h-64">
                {s.diagram}
              </div>
              <div className="mt-5 flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a78bfa] font-display text-sm font-bold text-navy-950">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-display text-xl font-bold leading-tight text-white lg:text-2xl">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-white/85">{s.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>

        <div className="mt-14 flex flex-col gap-6 border-t border-white/10 pt-8 lg:flex-row lg:items-center lg:justify-between">
          <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-8">
            {PERKS.map((p) => (
              <li key={p} className="flex items-center gap-2 text-[15px] text-white/85">
                <Check />
                {p}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-5">
            <Link
              href="/play/new-tournament"
              data-cursor="hot"
              className="inline-flex items-center rounded-full bg-[#a78bfa] px-7 py-3.5 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-950 transition-colors duration-200 hover:bg-white"
            >
              Create a Friends Tournament
            </Link>
            <Link
              href="/play/new-game"
              className="text-sm font-medium text-[#c4b5fd] underline underline-offset-4 hover:text-white"
            >
              or just start a game
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke={VIOLET} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/* ----- step 1 : 1v1 vs 2v2 ------------------------------------- */

function Player({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9" fill={color} aria-hidden>
      <circle cx="12" cy="8" r="4.2" />
      <path d="M3.5 21a8.5 8.5 0 0 1 17 0z" />
    </svg>
  );
}

function FormatDiagram() {
  const side = (count: number, color: string) => (
    <div className="flex">
      {Array.from({ length: count }, (_, i) => (
        <Player key={i} color={color} />
      ))}
    </div>
  );
  const option = (label: string, perSide: number, note: string) => (
    <div className="flex flex-1 flex-col items-center rounded-md border border-white/15 px-2 py-4">
      <span className="font-display text-lg font-bold text-white">{label}</span>
      <div className="mt-3 flex items-center gap-2">
        {side(perSide, VIOLET)}
        <span className="text-[11px] font-bold uppercase text-mist">vs</span>
        {side(perSide, PINK)}
      </div>
      <span className="mt-3 text-xs text-mist">{note}</span>
    </div>
  );
  return (
    <div
      role="img"
      aria-label="Two formats: 1v1 with two players, or 2v2 with four players"
      className="flex w-full max-w-sm gap-3"
    >
      {option("1v1", 1, "2 players")}
      {option("2v2", 2, "4 players")}
    </div>
  );
}

/* ----- step 2 : invite → accept -------------------------------- */

function InviteDiagram() {
  const friends = [
    { name: "Friend 1", accepted: true },
    { name: "Friend 2", accepted: true },
    { name: "Friend 3", accepted: false },
  ];
  return (
    <div
      role="img"
      aria-label="You send invites; each friend accepts from their own account"
      className="flex w-full max-w-sm items-center gap-3"
    >
      <div className="flex flex-col items-center">
        <Player color={VIOLET} />
        <span className="mt-1 text-xs font-semibold text-white">You</span>
      </div>

      <div className="flex flex-1 flex-col items-center">
        <span className="text-[11px] font-bold uppercase tracking-wide text-mist">Invite</span>
        <svg viewBox="0 0 80 12" className="mt-1 h-3 w-full" fill="none" stroke={VIOLET} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" preserveAspectRatio="none" aria-hidden>
          <path d="M2 6h74" />
          <path d="M70 1.5 76 6l-6 4.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      <ul className="w-[55%] space-y-2">
        {friends.map((f) => (
          <li
            key={f.name}
            className="flex items-center justify-between rounded-md border border-white/15 px-3 py-2 text-xs"
          >
            <span className="font-medium text-white">{f.name}</span>
            {f.accepted ? (
              <span className="flex items-center gap-1 font-semibold text-[#c4b5fd]">
                <Check />
                Accepted
              </span>
            ) : (
              <span className="text-mist">Pending</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----- step 3 : bracket with a BYE ----------------------------- */

function BracketDiagram() {
  const box = (x: number, y: number, label: string, tone: "plain" | "win" | "bye" | "final" = "plain") => (
    <g key={`${x}-${y}`}>
      <rect
        x={x}
        y={y}
        width={84}
        height={26}
        rx={4}
        fill={tone === "win" ? "rgba(167,139,250,0.22)" : tone === "final" ? "rgba(236,72,153,0.18)" : "none"}
        stroke={tone === "final" ? PINK : tone === "win" ? VIOLET : "rgba(255,255,255,0.22)"}
        strokeDasharray={tone === "bye" ? "4 3" : undefined}
      />
      <text
        x={x + 42}
        y={y + 17}
        textAnchor="middle"
        fontSize="11"
        fontWeight={tone === "plain" || tone === "bye" ? 500 : 700}
        fill={tone === "bye" ? "rgba(233,244,248,0.6)" : "#fff"}
      >
        {label}
      </text>
    </g>
  );
  return (
    <svg
      viewBox="0 0 320 196"
      className="h-full w-full max-w-sm"
      role="img"
      aria-label="Example bracket: three teams and a BYE, winners advance to the final"
    >
      {[
        [50, "Round 1"],
        [160, "Final"],
        [270, "Winner"],
      ].map(([x, t]) => (
        <text key={t} x={x} y={12} textAnchor="middle" fontSize="9" fontWeight={700} letterSpacing="1" fill="rgba(233,244,248,0.6)">
          {String(t).toUpperCase()}
        </text>
      ))}

      <g fill="none" stroke="rgba(167,139,250,0.7)" strokeWidth="1.5">
        <path d="M92 37h13v36H92M105 55h13" />
        <path d="M92 127h13v36H92M105 145h13" />
        <path d="M202 55h13v90h-13M215 100h13" />
      </g>

      {box(8, 24, "Team A", "win")}
      {box(8, 60, "Team B")}
      {box(8, 114, "Team C", "win")}
      {box(8, 150, "BYE", "bye")}
      {box(118, 42, "Team A", "win")}
      {box(118, 132, "Team C")}
      {box(228, 87, "Team A", "final")}
    </svg>
  );
}
