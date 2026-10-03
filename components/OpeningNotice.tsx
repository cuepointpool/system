"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OPENING_NOTICE, SITE } from "@/lib/config";
import { BrandMark } from "./BrandMark";

const SEEN_KEY = "cp_opening_notice_seen";

/** Full-screen "opening soon" notice, shown once per browser tab session.
 *  Visitors can book straight away or close it and browse the site. */
const noopSubscribe = () => () => {};

function alreadySeen(): boolean {
  try {
    return !!sessionStorage.getItem(SEEN_KEY);
  } catch {
    return false; // storage blocked — show it, it just won't be remembered
  }
}

export function OpeningNotice() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  // server render = "seen" so nothing flashes before hydration
  const seen = useSyncExternalStore(noopSubscribe, alreadySeen, () => true);

  const open =
    OPENING_NOTICE.enabled && !pathname.startsWith("/admin") && !seen && !dismissed;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="opening-title"
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-navy-950/95 px-5 py-10 backdrop-blur-md"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close notice and go to the website"
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-xl text-white/80 transition-colors hover:border-white/40 hover:text-white"
      >
        ✕
      </button>

      <div className="mx-auto w-full max-w-xl text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-teal">
          {SITE.name} · {SITE.kicker}
        </p>
        <BrandMark size={72} className="mt-6" />
        <h2
          id="opening-title"
          className="mt-5 font-display text-4xl font-bold leading-tight text-white sm:text-6xl"
        >
          {OPENING_NOTICE.headline}
        </h2>
        {OPENING_NOTICE.openingDate && (
          <p className="mt-4 font-display text-xl font-semibold text-teal-bright">
            {OPENING_NOTICE.openingDate}
          </p>
        )}
        <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-mist">
          {OPENING_NOTICE.message}
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/book"
            onClick={close}
            className="w-full rounded-full bg-teal px-8 py-3.5 font-display text-sm font-semibold uppercase tracking-wider text-navy-950 transition-colors hover:bg-teal-bright sm:w-auto"
          >
            Book a table
          </Link>
          <button
            type="button"
            onClick={close}
            className="w-full rounded-full border border-white/20 px-8 py-3.5 font-display text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:border-white/50 sm:w-auto"
          >
            Continue to website
          </button>
        </div>

        <p className="mt-8 text-xs text-mist">
          Questions? Call{" "}
          <a href={SITE.phoneHref} className="font-semibold text-white underline">
            {SITE.phone}
          </a>
        </p>
      </div>
    </div>
  );
}
