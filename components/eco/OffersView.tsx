"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDateShort } from "@/lib/utils";
import type { Promotion } from "@/lib/ecosystem/types";

type Promo = Promotion & { state: "upcoming" | "active" | "expired" };

const IMG: Record<string, string> = {
  teal: "linear-gradient(135deg,#0c4a4a,#062231)",
  navy: "linear-gradient(135deg,#0e2b46,#05101c)",
  spot: "linear-gradient(135deg,#1a3a2a,#062231)",
  gold: "linear-gradient(135deg,#3a2f12,#062231)",
};

const STATE_META = {
  active: { label: "Active now", cls: "bg-teal/15 text-teal ring-teal/30" },
  upcoming: { label: "Coming soon", cls: "bg-sky-400/12 text-sky-200 ring-sky-300/25" },
  expired: { label: "Ended", cls: "bg-white/[0.05] text-mist/60 ring-white/10" },
};

export function OffersView({
  active,
  upcoming,
  expired,
}: {
  active: Promo[];
  upcoming: Promo[];
  expired: Promo[];
}) {
  const [showExpired, setShowExpired] = useState(false);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-28 md:px-8">
      {active.length > 0 && (
        <Group label={`Active offers (${active.length})`}>
          {active.map((p, i) => (
            <PromoCard key={p.id} p={p} delay={i * 0.05} />
          ))}
        </Group>
      )}

      {upcoming.length > 0 && (
        <Group label="Starting soon">
          {upcoming.map((p, i) => (
            <PromoCard key={p.id} p={p} delay={i * 0.05} />
          ))}
        </Group>
      )}

      {active.length === 0 && upcoming.length === 0 && (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-mist">
          No live offers right now — check back soon.
        </p>
      )}

      {expired.length > 0 && (
        <div className="mt-16">
          <button
            onClick={() => setShowExpired((v) => !v)}
            className="text-xs font-medium text-mist transition-colors hover:text-white"
          >
            {showExpired ? "Hide" : "Show"} past offers ({expired.length})
          </button>
          <AnimatePresence>
            {showExpired && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-5 grid gap-5 opacity-60 sm:grid-cols-2 lg:grid-cols-3">
                  {expired.map((p) => (
                    <PromoCard key={p.id} p={p} delay={0} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-14">
      <h2 className="mb-5 text-xs uppercase tracking-[0.24em] text-teal">{label}</h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function PromoCard({ p, delay }: { p: Promo; delay: number }) {
  const [copied, setCopied] = useState(false);
  const meta = STATE_META[p.state];

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition-all duration-300 hover:-translate-y-1 hover:border-teal/30 hover:shadow-[0_28px_70px_-38px_rgba(0,194,168,0.4)]"
    >
      <div
        className="relative h-28 overflow-hidden"
        style={{ background: IMG[p.image] ?? IMG.navy }}
      >
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.5),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(0,194,168,0.5),transparent_45%)]" />
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1",
            meta.cls,
          )}
        >
          {meta.label}
        </span>
        <span className="absolute bottom-3 right-3 rounded-lg bg-black/40 px-2.5 py-1.5 font-display text-sm font-bold text-white ring-1 ring-white/10">
          {p.discount}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-bold text-white">{p.title}</h3>
        <p className="mt-1.5 flex-1 text-[13px] text-mist">{p.description}</p>

        <div className="mt-4 space-y-1.5 text-[11px] text-mist/70">
          <div>
            <span className="text-mist/50">Who: </span>
            {p.eligibility}
          </div>
          <div>
            <span className="text-mist/50">Valid: </span>
            {formatDateShort(p.startAt)} – {formatDateShort(p.endAt)}
          </div>
          {p.usageNote && (
            <div>
              <span className="text-mist/50">Note: </span>
              {p.usageNote}
            </div>
          )}
        </div>

        {p.promoCode && p.state !== "expired" && (
          <button
            onClick={() => {
              navigator.clipboard?.writeText(p.promoCode!);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="mt-4 flex items-center justify-between rounded-lg border border-dashed border-teal/40 bg-teal/[0.06] px-3 py-2 text-left"
          >
            <span className="font-mono text-sm font-semibold tracking-wider text-teal">
              {p.promoCode}
            </span>
            <span className="text-[11px] text-mist">
              {copied ? "Copied ✓" : "Tap to copy"}
            </span>
          </button>
        )}
      </div>
    </motion.article>
  );
}
