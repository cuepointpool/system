import Image from "next/image";
import Link from "next/link";
import { SITE, TABLE_HOURLY_RATE } from "@/lib/config";
import { LKR_PER_POINT } from "@/lib/ecosystem/economics";
import { cn, formatLKR } from "@/lib/utils";
import type { MembershipPlan, Reward } from "@/lib/ecosystem/types";
import { BrandMark, SectionKicker } from "@/components/BrandMark";

const btnPrimary =
  "inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-950 transition-colors duration-200 hover:bg-gold";
const btnSecondary =
  "inline-flex w-full items-center justify-center rounded-full border border-white/60 px-6 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-white transition-colors duration-200 hover:border-white hover:bg-white hover:text-navy-950";

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="mt-1 h-4 w-4 shrink-0 text-teal" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function MembershipView({
  plans,
  rewards,
  currentTier,
  signedIn,
  points,
}: {
  plans: MembershipPlan[];
  rewards: Reward[];
  currentTier: string | null;
  signedIn: boolean;
  /** the signed-in player's points balance; null when signed out or not a player */
  points: number | null;
}) {
  const sorted = [...rewards].sort((a, b) => a.cost - b.cost);
  // one ladder stop per distinct price
  const levels: { cost: number; names: string[] }[] = [];
  for (const r of sorted) {
    const last = levels[levels.length - 1];
    if (last && last.cost === r.cost) last.names.push(r.name);
    else levels.push({ cost: r.cost, names: [r.name] });
  }
  const next = points == null ? null : (sorted.find((r) => r.cost > points) ?? null);

  return (
    <div className="space-y-20 px-5 pb-28 md:px-8 lg:px-12">
      {/* ---------------- plans ---------------- */}
      <section>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const current = plan.id === currentTier;
            const paid = plan.price > 0;
            return (
              <article
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-lg bg-navy-900 p-6 sm:p-8",
                  current && "outline outline-2 outline-teal",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-2xl font-bold text-gold">{plan.name}</h2>
                  <BrandMark size={36} />
                </div>
                <p className="mt-1 text-[15px] text-mist">{plan.tagline}</p>

                <p className="mt-6 flex items-baseline gap-2">
                  <span className="font-display text-5xl font-bold leading-none text-white">
                    {paid ? formatLKR(plan.price) : "Free"}
                  </span>
                  {paid && <span className="text-sm text-mist">a month</span>}
                </p>

                <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-white/10 py-4">
                  <div>
                    <dt className="text-xs text-mist">Table time</dt>
                    <dd className="mt-1 font-display text-xl font-bold text-white">
                      {plan.discountPct > 0 ? `${plan.discountPct}% off` : "Standard price"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-mist">Points</dt>
                    <dd className="mt-1 font-display text-xl font-bold text-white">
                      {plan.loyaltyMultiplier}× earning
                    </dd>
                  </div>
                </dl>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-[15px] leading-relaxed text-white/90">
                      <Check />
                      {b}
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  {current ? (
                    <p className="rounded-full border border-teal py-3 text-center text-[12px] font-bold uppercase tracking-[0.08em] text-teal">
                      Your current plan
                    </p>
                  ) : paid ? (
                    <a href={SITE.phoneHref} className={btnSecondary}>
                      Call to join {plan.name}
                    </a>
                  ) : signedIn ? (
                    <Link href="/book" className={btnPrimary}>
                      Book a table
                    </Link>
                  ) : (
                    <Link href="/account?next=/membership" className={btnPrimary}>
                      Create free account
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-mist">
          Pro and Elite are set up at the counter or by phone on{" "}
          <a href={SITE.phoneHref} className="font-semibold text-white underline underline-offset-4">
            {SITE.phone}
          </a>
          , and run month to month. Create your free account first so we have a profile to
          attach the plan to. A monthly fair-use limit applies to plan discounts and bonus points.
        </p>
      </section>

      {/* ---------------- how points work ---------------- */}
      <section>
        <SectionKicker>Points</SectionKicker>
        <h2 className="mt-3 font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl">
          How points work
        </h2>

        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              big: formatLKR(LKR_PER_POINT),
              title: "Play",
              body: `Every ${formatLKR(LKR_PER_POINT)} you pay for table time earns 1 point. An hour at ${formatLKR(TABLE_HOURLY_RATE)} is ${TABLE_HOURLY_RATE / LKR_PER_POINT} points.`,
            },
            {
              big: "1 pt",
              title: "Collect",
              body: "Points are added to your account automatically when your table time is paid. Pro earns 1.5× and Elite 2×.",
            },
            {
              big: `${sorted[0]?.cost.toLocaleString() ?? "750"}+`,
              title: "Redeem",
              body: "Swap points for table time, a snack pack and more. Tell the counter what you want and we take the points off your balance.",
            },
          ].map((s, i) => (
            <li key={s.title} className="rounded-lg bg-navy-900 p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal font-display text-sm font-bold text-navy-950">
                  {i + 1}
                </span>
                <h3 className="font-display text-xl font-bold text-white">{s.title}</h3>
              </div>
              <p className="mt-4 font-display text-4xl font-bold leading-none text-gold">{s.big}</p>
              <p className="mt-3 text-[15px] leading-relaxed text-white/85">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------- rewards ---------------- */}
      <section>
        <SectionKicker>Rewards</SectionKicker>
        <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl">
            What your points get you
          </h2>
          <BalanceDial points={points} next={next} />
        </div>

        {/* the ladder: every reward level as a stop on one line */}
        <RewardLadder levels={levels} points={points} />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((r) => {
            const unlocked = points != null && points >= r.cost;
            const pct = points == null ? 0 : Math.min(100, Math.round((points / r.cost) * 100));
            return (
              <article key={r.id} className="group overflow-hidden rounded-lg bg-navy-900">
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={REWARD_IMAGE[r.id] ?? CATEGORY_IMAGE[r.category] ?? CATEGORY_IMAGE.play}
                    alt=""
                    fill
                    sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-navy-950 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
                    {CATEGORY_LABEL[r.category] ?? "Reward"}
                  </span>
                </div>

                <div className="relative p-6 pt-8">
                  {/* points token, sitting on the photo's edge */}
                  <span
                    className={cn(
                      "absolute -top-10 right-5 grid h-20 w-20 place-items-center rounded-full text-center ring-4 ring-navy-900",
                      unlocked ? "bg-teal text-navy-950" : "bg-gold text-navy-950",
                    )}
                  >
                    <span>
                      <span className="block font-display text-xl font-bold leading-none tabular-nums">
                        {r.cost.toLocaleString()}
                      </span>
                      <span className="block text-[10px] font-bold uppercase tracking-[0.1em]">pts</span>
                    </span>
                  </span>

                  <h3 className="max-w-[75%] font-display text-xl font-bold leading-tight text-white">
                    {r.name}
                  </h3>
                  <p className="mt-1.5 text-[15px] text-mist">{r.description}</p>

                  {points != null && (
                    <div className="mt-5">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={cn("h-full rounded-full", unlocked ? "bg-teal" : "bg-gold")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-2 text-sm text-white/85">
                        {unlocked
                          ? "You have enough points. Ask at the counter to redeem it."
                          : `${(r.cost - points).toLocaleString()} more points to go`}
                      </p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {points == null && (
          <p className="mt-6 text-sm text-mist">
            <Link href="/account?next=/membership" className="font-semibold text-white underline underline-offset-4">
              Sign in
            </Link>{" "}
            to see your balance and how close you are to each reward.
          </p>
        )}
      </section>
    </div>
  );
}

/* ---- reward artwork ---------------------------------------------------- */

const REWARD_IMAGE: Record<string, string> = {
  rw_disc15: "/media/story/book-bg.jpg",
  rw_play30: "/media/story/gallery-hall.jpg",
  rw_play60: "/media/story/why-tables.jpg",
  rw_food: "/media/venue/snack-pack.jpg",
  rw_tourney: "/media/story/tournaments.jpg",
  rw_merch: "/media/story/reward-chalk.jpg",
};
const CATEGORY_IMAGE: Record<string, string> = {
  play: "/media/story/gallery-hall.jpg",
  discount: "/media/story/book-bg.jpg",
  food: "/media/venue/snack-pack.jpg",
  tournament: "/media/story/tournaments.jpg",
  merch: "/media/story/reward-chalk.jpg",
};
const CATEGORY_LABEL: Record<string, string> = {
  play: "Table time",
  discount: "Discount",
  food: "Food",
  tournament: "Tournament",
  merch: "Kit",
};

/* ---- balance dial: a ring that fills toward the next reward ------------- */

function BalanceDial({ points, next }: { points: number | null; next: Reward | null }) {
  if (points == null) return null;
  const R = 34;
  const C = 2 * Math.PI * R;
  const frac = next ? Math.min(1, points / next.cost) : 1;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 80 80" className="h-20 w-20 shrink-0 -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          stroke="#f4c430"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${C * frac} ${C}`}
        />
      </svg>
      <div>
        <p className="text-xs text-mist">Your balance</p>
        <p className="font-display text-3xl font-bold leading-none tabular-nums text-white">
          {points.toLocaleString()} <span className="text-base text-gold">pts</span>
        </p>
        <p className="mt-1 text-sm text-white/85">
          {next
            ? `${(next.cost - points).toLocaleString()} to ${next.name.toLowerCase()}`
            : "Every reward is within reach"}
        </p>
      </div>
    </div>
  );
}

/* ---- reward ladder: stops on a line, filled up to the player's balance --- */

function RewardLadder({
  levels,
  points,
}: {
  levels: { cost: number; names: string[] }[];
  points: number | null;
}) {
  if (levels.length < 2) return null;
  // stops are evenly spaced; the fill runs proportionally between two stops
  let filled = 0;
  if (points != null) {
    const i = levels.findIndex((l) => points < l.cost);
    if (i === -1) filled = levels.length;
    else {
      const prev = i === 0 ? 0 : levels[i - 1].cost;
      filled = i + (points - prev) / (levels[i].cost - prev);
    }
  }
  // the line runs from the first stop to the last
  const pct = Math.max(0, Math.min(100, ((filled - 1) / (levels.length - 1)) * 100));

  return (
    <div className="mt-10 rounded-lg bg-navy-900 p-6 sm:p-8">
      {/* desktop: horizontal */}
      <div className="relative hidden md:block">
        <div className="absolute inset-x-0 top-[9px] mx-[calc(50%/var(--n))] h-1 rounded-full bg-white/10" style={{ "--n": levels.length } as React.CSSProperties}>
          <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
        </div>
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${levels.length}, minmax(0, 1fr))` }}>
          {levels.map((l) => {
            const reached = points != null && points >= l.cost;
            return (
              <li key={l.cost} className="flex flex-col items-center px-2 text-center">
                <span
                  className={cn(
                    "h-[22px] w-[22px] rotate-45 rounded-[5px] border-2",
                    reached ? "border-gold bg-gold" : "border-white/40 bg-navy-900",
                  )}
                />
                <span className="mt-4 font-display text-xl font-bold tabular-nums text-gold">
                  {l.cost.toLocaleString()}
                </span>
                <span className="mt-1 text-sm leading-snug text-white/85">
                  {l.names.join(" · ")}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* mobile: vertical */}
      <ol className="relative space-y-6 md:hidden">
        <span className="absolute bottom-3 left-[10px] top-3 w-0.5 bg-white/10" aria-hidden />
        {levels.map((l) => {
          const reached = points != null && points >= l.cost;
          return (
            <li key={l.cost} className="relative flex items-start gap-4">
              <span
                className={cn(
                  "mt-1 h-[22px] w-[22px] shrink-0 rotate-45 rounded-[5px] border-2",
                  reached ? "border-gold bg-gold" : "border-white/40 bg-navy-900",
                )}
              />
              <span>
                <span className="block font-display text-xl font-bold leading-none tabular-nums text-gold">
                  {l.cost.toLocaleString()} pts
                </span>
                <span className="mt-1 block text-sm text-white/85">{l.names.join(" · ")}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
