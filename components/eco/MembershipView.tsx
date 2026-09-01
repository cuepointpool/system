"use client";

import { motion } from "framer-motion";
import { MembershipBadge } from "./Primitives";
import { MagneticButton } from "@/components/MagneticButton";
import { cn, formatLKR } from "@/lib/utils";
import type { MembershipPlan, Reward } from "@/lib/ecosystem/types";

const REWARD_ICON: Record<string, string> = {
  clock: "◷",
  tag: "%",
  trophy: "🏆",
  cup: "☕",
  box: "▣",
};

export function MembershipView({
  plans,
  rewards,
  currentTier,
}: {
  plans: MembershipPlan[];
  rewards: Reward[];
  currentTier: string | null;
}) {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
      <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
        {plans.map((plan, i) => {
          const current = plan.id === currentTier;
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-[24px] border p-6 transition-all duration-300 sm:p-7",
                plan.featured
                  ? "border-teal/40 bg-[linear-gradient(165deg,rgba(0,194,168,0.12),rgba(5,16,28,0.4))] lg:-translate-y-3 lg:shadow-[0_40px_100px_-50px_rgba(0,194,168,0.5)]"
                  : "border-white/12 bg-white/[0.025]",
              )}
            >
              {plan.featured && (
                <span className="absolute right-5 top-5 rounded-full bg-teal px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-navy-950">
                  Most popular
                </span>
              )}
              <MembershipBadge tier={plan.id} />
              <h3 className="mt-4 font-display text-2xl font-bold text-white">
                {plan.name}
              </h3>
              <p className="mt-1 text-[13px] text-mist">{plan.tagline}</p>

              <div className="mt-5 flex items-end gap-1.5">
                <span className="font-display text-4xl font-bold text-white">
                  {plan.price === 0 ? "Free" : formatLKR(plan.price)}
                </span>
                {plan.price > 0 && (
                  <span className="pb-1.5 text-xs text-mist">
                    / {plan.billingPeriod}
                  </span>
                )}
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center text-[11px]">
                <Mini k="Table disc." v={`${plan.discountPct}%`} />
                <Mini k="Loyalty" v={`${plan.loyaltyMultiplier}×`} />
                <Mini
                  k="Priority"
                  v={["–", "Std", "High", "Top"][plan.bookingPriority] ?? "Std"}
                />
              </div>

              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-[13px] text-mist">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-teal/15 text-[9px] text-teal">
                      ✓
                    </span>
                    {b}
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {current ? (
                  <span className="block rounded-full border border-teal/40 bg-teal/10 py-2.5 text-center text-sm font-semibold text-teal">
                    Your current plan
                  </span>
                ) : (
                  <MagneticButton
                    href="/book"
                    variant={plan.featured ? "primary" : "ghost"}
                    block
                    className="justify-center"
                  >
                    {plan.price === 0 ? "Start free" : `Choose ${plan.name}`}
                  </MagneticButton>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* loyalty rewards */}
      <section className="mt-20">
        <h2 className="text-xs uppercase tracking-[0.28em] text-teal">
          Loyalty rewards
        </h2>
        <p className="mt-3 max-w-xl text-mist">
          Earn points on every booking, match and tournament. Higher tiers earn
          faster. Redeem for table time and more — the catalogue changes each
          season.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal/12 text-lg text-teal">
                  {REWARD_ICON[r.icon] ?? "★"}
                </span>
                <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-white">
                  {r.cost.toLocaleString()} pts
                </span>
              </div>
              <h3 className="mt-3 font-display text-base font-semibold text-white">
                {r.name}
              </h3>
              <p className="mt-1 text-[13px] text-mist">{r.description}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="font-display text-sm font-bold text-white">{v}</div>
      <div className="text-[10px] text-mist/60">{k}</div>
    </div>
  );
}
