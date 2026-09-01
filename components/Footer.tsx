"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { scrollToId } from "./SmoothScroll";
import { NAV_LINKS, SITE } from "@/lib/config";

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-navy-950 pt-20">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-5 text-sm text-mist">
              {SITE.description}
            </p>
            <div className="mt-6 flex gap-3">
              {Object.entries(SITE.socials).map(([k, href]) => (
                <a
                  key={k}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-10 w-10 place-items-center rounded-full glass text-xs uppercase text-mist transition-colors hover:text-teal"
                  aria-label={k}
                >
                  {k[0]}
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <div>
              <h4 className="text-xs uppercase tracking-[0.25em] text-teal">Explore</h4>
              <ul className="mt-4 space-y-2.5">
                {NAV_LINKS.map((l) => (
                  <li key={l.href}>
                    <button
                      onClick={() => scrollToId(l.href)}
                      className="text-sm text-mist transition-colors hover:text-white"
                    >
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-[0.25em] text-teal">Play</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-mist">
                <li>
                  <Link href="/book" className="transition-colors hover:text-white">
                    Book a table
                  </Link>
                </li>
                <li>
                  <Link href="/book?table=table-3" className="transition-colors hover:text-white">
                    Reserve a VIP booth
                  </Link>
                </li>
                <li>
                  <a href={SITE.phoneHref} className="transition-colors hover:text-white">
                    Call the room
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-[0.25em] text-teal">Visit</h4>
              <address className="mt-4 space-y-2.5 text-sm not-italic text-mist">
                <p>
                  {SITE.address.line1}, {SITE.address.line2}
                </p>
                <p>{SITE.address.country}</p>
                <p>
                  <a href={`mailto:${SITE.email}`} className="transition-colors hover:text-white">
                    {SITE.email}
                  </a>
                </p>
              </address>
            </div>
          </div>
        </div>

        <button
          onClick={() => scrollToId("home")}
          className="mt-14 flex w-full items-center justify-between border-t border-white/10 pt-6 text-mist transition-colors hover:text-white"
        >
          <span className="text-xs uppercase tracking-[0.3em]">Back to top</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 19V5M6 11l6-6 6 6"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="relative mt-10 select-none">
        <div
          aria-hidden
          className="whitespace-nowrap text-center font-display text-[19vw] font-bold leading-[0.8] text-stroke"
        >
          CUE&nbsp;POINT
        </div>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-6 text-xs text-mist md:flex-row md:px-8">
          <span>© {new Date().getFullYear()} Cue Point Pool Parlour. All rights reserved.</span>
          <span>Pitipana · Homagama · Sri Lanka</span>
        </div>
      </div>
    </footer>
  );
}
