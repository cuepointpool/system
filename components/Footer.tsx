"use client";

import Image from "next/image";
import Link from "next/link";
import { scrollToId } from "./SmoothScroll";
import { HOURS_DISPLAY, NAV_LINKS, SITE } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-navy-950 pt-16">
      <div className="px-5 md:px-8 lg:px-12">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <Image
              src="/media/logo-full.png"
              alt="Cue Point Pool Parlour"
              width={160}
              height={160}
              className="h-36 w-36 rounded-lg object-cover"
            />
            <p className="mt-5 text-[15px] leading-relaxed text-mist">
              {SITE.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <div>
              <h4 className="text-sm font-semibold text-white">Explore</h4>
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
              <h4 className="text-sm font-semibold text-white">Play</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-mist">
                <li>
                  <Link href="/book" className="transition-colors hover:text-white">
                    Book a table
                  </Link>
                </li>
                <li>
                  <Link href="/play" className="transition-colors hover:text-white">
                    Play with friends
                  </Link>
                </li>
                <li>
                  <Link href="/rankings" className="transition-colors hover:text-white">
                    Rankings
                  </Link>
                </li>
                <li>
                  <Link href="/tournaments" className="transition-colors hover:text-white">
                    Tournaments
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Visit</h4>
              <address className="mt-4 space-y-2.5 text-sm not-italic text-mist">
                <p>
                  {SITE.address.line1}, {SITE.address.line2}, {SITE.address.country}
                </p>
                <p>
                  {HOURS_DISPLAY[0].day}, {HOURS_DISPLAY[0].time}
                </p>
                <p>
                  <a href={SITE.phoneHref} className="transition-colors hover:text-white">
                    {SITE.phone}
                  </a>
                </p>
                <p>
                  <a href={`mailto:${SITE.email}`} className="transition-colors hover:text-white">
                    {SITE.email}
                  </a>
                </p>
              </address>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-white/10 py-6 text-xs text-mist sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Cue Point Pool Parlour. All rights reserved.</span>
          <button
            onClick={() => scrollToId("home")}
            className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
          >
            Back to top
          </button>
        </div>
      </div>
    </footer>
  );
}
