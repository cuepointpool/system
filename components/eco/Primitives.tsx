"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { cn, gradientFromString, initials } from "@/lib/utils";
import type {
  MatchResult,
  MembershipTier,
  SkillLevel,
} from "@/lib/ecosystem/types";

/* ---------------------------------------------------------------- */
/*  Player avatar — image or deterministic initials tile           */
/* ---------------------------------------------------------------- */

const AVATAR_SIZES = {
  xs: "h-8 w-8 text-[11px]",
  sm: "h-10 w-10 text-xs",
  md: "h-14 w-14 text-sm",
  lg: "h-20 w-20 text-lg",
  xl: "h-28 w-28 text-2xl",
} as const;

export function PlayerAvatar({
  name,
  src,
  size = "sm",
  ring = false,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof AVATAR_SIZES;
  ring?: boolean;
  className?: string;
}) {
  const [g1, g2] = gradientFromString(name);
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-display font-semibold text-white/90",
        AVATAR_SIZES[size],
        ring && "ring-2 ring-teal/60 ring-offset-2 ring-offset-navy-950",
        className,
      )}
      style={src ? undefined : { backgroundImage: `linear-gradient(140deg, ${g1}, ${g2})` }}
    >
      {src ? (
        <Image src={src} alt={name} fill sizes="112px" className="object-cover" />
      ) : (
        <>
          <span className="absolute inset-0 bg-[radial-gradient(60%_60%_at_30%_25%,rgba(0,194,168,0.28),transparent_70%)]" />
          <span className="relative">{initials(name)}</span>
        </>
      )}
    </span>
  );
}

/* ---------------------------------------------------------------- */
/*  Recent form  W W L W W                                         */
/* ---------------------------------------------------------------- */

export function FormDots({
  form,
  size = "sm",
}: {
  form: MatchResult[];
  size?: "sm" | "md";
}) {
  const dim = size === "md" ? "h-6 w-6 text-[11px]" : "h-4 w-4 text-[9px]";
  if (!form.length)
    return <span className="text-xs text-mist/50">No matches yet</span>;
  return (
    <span className="inline-flex gap-1">
      {form.map((r, i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 20 }}
          className={cn(
            "grid place-items-center rounded-[5px] font-bold",
            dim,
            r === "W"
              ? "bg-teal/20 text-teal ring-1 ring-teal/40"
              : "bg-white/[0.06] text-mist/60 ring-1 ring-white/10",
          )}
        >
          {r}
        </motion.span>
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------- */
/*  Ranking movement indicator                                     */
/* ---------------------------------------------------------------- */

export function RankMovement({ delta }: { delta: number }) {
  const up = delta > 0;
  const flat = delta === 0;
  return (
    <motion.span
      initial={{ opacity: 0, y: up ? 6 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        flat && "bg-white/[0.05] text-mist/50",
        up && "bg-teal/15 text-teal",
        !up && !flat && "bg-rose-500/15 text-rose-300",
      )}
    >
      {flat ? "—" : up ? "▲" : "▼"}
      {!flat && Math.abs(delta)}
    </motion.span>
  );
}

/* ---------------------------------------------------------------- */
/*  Membership + skill chips                                        */
/* ---------------------------------------------------------------- */

const TIER_STYLE: Record<MembershipTier, string> = {
  basic: "bg-white/[0.06] text-mist ring-white/12",
  pro: "bg-teal/12 text-teal ring-teal/35",
  elite:
    "bg-[linear-gradient(120deg,rgba(42,240,214,0.18),rgba(0,164,143,0.12))] text-teal-bright ring-teal-bright/40",
};

export function MembershipBadge({
  tier,
  className,
}: {
  tier: MembershipTier;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ring-1",
        TIER_STYLE[tier],
        className,
      )}
    >
      {tier === "elite" && <span aria-hidden>◆</span>}
      {tier}
    </span>
  );
}

const SKILL_STYLE: Record<SkillLevel, string> = {
  Rookie: "text-mist/70 ring-white/12",
  Amateur: "text-sky-200/80 ring-sky-300/20",
  Intermediate: "text-teal/90 ring-teal/25",
  Advanced: "text-teal-bright/90 ring-teal-bright/30",
  Pro: "text-white ring-white/25",
};

export function SkillTag({ level }: { level: SkillLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ring-1",
        SKILL_STYLE[level],
      )}
    >
      {level}
    </span>
  );
}

/* ---------------------------------------------------------------- */
/*  Animated stat tile                                             */
/* ---------------------------------------------------------------- */

export function StatTile({
  label,
  value,
  suffix = "",
  decimals = 0,
  accent = false,
  hint,
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  accent?: boolean;
  hint?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setN(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1100);
      setN((1 - Math.pow(1 - p, 3)) * value);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border p-4 transition-colors sm:p-5",
        accent
          ? "border-teal/25 bg-teal/[0.06]"
          : "border-white/10 bg-white/[0.02]",
      )}
    >
      <div
        className={cn(
          "font-display text-2xl font-bold tabular-nums sm:text-3xl",
          accent ? "text-teal-bright" : "text-white",
        )}
      >
        {n.toLocaleString("en-LK", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
        <span className="text-teal">{suffix}</span>
      </div>
      <div className="mt-1.5 text-xs text-mist">{label}</div>
      {hint && <div className="mt-0.5 text-[10px] text-mist/50">{hint}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  Section header (page/preview)                                  */
/* ---------------------------------------------------------------- */

export function SectionHeader({
  kicker,
  title,
  children,
  align = "left",
  className,
}: {
  kicker?: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        align === "center" && "mx-auto max-w-2xl text-center",
        className,
      )}
    >
      {kicker && (
        <span className="text-xs uppercase tracking-[0.32em] text-teal">
          {kicker}
        </span>
      )}
      <h2 className="mt-3 font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl md:text-5xl">
        {title}
      </h2>
      {children && <p className="mt-4 text-mist">{children}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  Animated tab switcher                                          */
/* ---------------------------------------------------------------- */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  size = "md",
  layoutId,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  layoutId?: string;
}) {
  const lid = layoutId ?? "eco-tab-" + tabs.map((t) => t.value).join("");
  return (
    <div
      className={cn(
        "hide-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.03] p-1",
        size === "sm" ? "text-xs" : "text-[13px]",
      )}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative shrink-0 rounded-full px-4 py-2 font-medium transition-colors",
              active ? "text-navy-950" : "text-mist hover:text-white",
            )}
          >
            {active && (
              <motion.span
                layoutId={lid}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                className="absolute inset-0 rounded-full bg-teal"
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {t.label}
              {typeof t.count === "number" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px]",
                    active ? "bg-navy-950/15 text-navy-950" : "bg-white/10 text-mist",
                  )}
                >
                  {t.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  Countdown                                                      */
/* ---------------------------------------------------------------- */

export function Countdown({
  to,
  compact = false,
}: {
  to: string;
  compact?: boolean;
}) {
  // start null so SSR + first client render match; fill in after mount
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(+new Date(to) - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [to]);

  if (left === null)
    return (
      <span className="font-display text-sm font-semibold tabular-nums text-white/50">
        --:--:--
      </span>
    );

  if (left <= 0)
    return <span className="text-sm font-medium text-teal">Underway</span>;

  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const parts = [
    { v: d, l: "days" },
    { v: h, l: "hrs" },
    { v: m, l: "min" },
    { v: s, l: "sec" },
  ].filter((p, i) => (d === 0 && i === 0 ? false : true));

  if (compact)
    return (
      <span className="font-display text-sm font-semibold tabular-nums text-white">
        {d > 0 ? `${d}d ` : ""}
        {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:
        {String(s).padStart(2, "0")}
      </span>
    );

  return (
    <div className="flex gap-2">
      {parts.map((p) => (
        <div
          key={p.l}
          className="min-w-[52px] rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-center"
        >
          <div className="font-display text-xl font-bold tabular-nums text-white">
            {String(p.v).padStart(2, "0")}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-mist/60">
            {p.l}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/*  Inner-page hero shell (no video, matches homepage language)    */
/* ---------------------------------------------------------------- */

export function PageHero({
  kicker,
  title,
  intro,
  actions,
  children,
  wordmark,
}: {
  kicker: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  wordmark?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden pb-10 pt-28 sm:pt-32">
      <div className="pointer-events-none absolute -left-24 top-10 -z-10 h-72 w-72 rounded-full bg-teal/15 blur-[110px]" />
      <div className="pointer-events-none absolute right-0 top-0 -z-10 h-80 w-96 rounded-full bg-navy-700/40 blur-[120px]" />
      {wordmark && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-6 -z-10 hidden text-center font-display text-[16vw] font-bold leading-none text-stroke sm:block"
        >
          {wordmark}
        </div>
      )}
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-xs uppercase tracking-[0.34em] text-teal">
            {kicker}
          </span>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.02] tracking-[-0.02em] text-white sm:text-5xl md:text-6xl">
            {title}
          </h1>
          {intro && (
            <p className="mt-5 max-w-xl text-[15px] text-mist sm:text-base">
              {intro}
            </p>
          )}
          {actions && <div className="mt-7 flex flex-wrap gap-3">{actions}</div>}
        </motion.div>
        {children && <div className="mt-10">{children}</div>}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/*  Card with hover-lift                                           */
/* ---------------------------------------------------------------- */

export function EcoCard({
  children,
  className,
  href,
  interactive = true,
}: {
  children: React.ReactNode;
  className?: string;
  href?: string;
  interactive?: boolean;
}) {
  const cls = cn(
    "group relative rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition-all duration-300",
    interactive &&
      "hover:-translate-y-1 hover:border-teal/30 hover:bg-white/[0.04] hover:shadow-[0_24px_60px_-30px_rgba(0,194,168,0.35)]",
    className,
  );
  if (href)
    return (
      <Link href={href} className={cls} data-cursor="hot">
        {children}
      </Link>
    );
  return <div className={cls}>{children}</div>;
}

/* re-export for convenience */
export { AnimatePresence, motion };
