"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChartIcon, HomeIcon, PlayIcon, TrophyIcon, UserIcon } from "./Icons";

/**
 * Fixed bottom navigation — the primary way around the game on mobile.
 * On desktop (lg+) the same items become a left rail; see GameShell.
 *
 * "Play" is the raised centre action and points at the real-world loop:
 * booking a table at the parlour is how you actually play a mission.
 */
const ITEMS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/campaign", label: "Campaign", Icon: TrophyIcon },
  { href: "/book", label: "Play", Icon: PlayIcon, center: true },
  { href: "/leaderboard", label: "Leaderboard", Icon: ChartIcon },
  { href: "/profile", label: "Profile", Icon: UserIcon },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Game navigation"
      className="fixed inset-x-0 bottom-0 z-40 pb-safe lg:hidden"
    >
      <div className="border-t border-white/10 bg-navy-950/92 backdrop-blur-xl">
        <ul className="mx-auto flex max-w-3xl items-end justify-around px-2 pb-1.5 pt-2">
          {ITEMS.map(({ href, label, Icon, ...rest }) => {
            const center = "center" in rest && rest.center;
            const active = isActive(pathname, href);

            if (center) {
              return (
                <li key={href} className="-mt-7">
                  <Link
                    href={href}
                    className="flex w-20 flex-col items-center gap-1"
                    aria-label={label}
                  >
                    <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-teal bg-navy-950 text-teal shadow-[0_0_28px_-4px_rgba(0,194,168,0.75)] transition-transform active:scale-95">
                      <Icon className="h-7 w-7 translate-x-[1px]" />
                    </span>
                    <span className="text-[10px] font-medium text-mist">{label}</span>
                  </Link>
                </li>
              );
            }

            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-[48px] w-[68px] flex-col items-center justify-center gap-1 rounded-xl transition-colors",
                    active ? "text-teal" : "text-mist/70 active:text-white",
                  )}
                >
                  <Icon className="h-[22px] w-[22px]" />
                  <span className="text-[10px] font-medium leading-none">{label}</span>
                  {active && (
                    <motion.span
                      layoutId="game-nav-active"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute -bottom-0.5 h-[3px] w-6 rounded-full bg-teal"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

/** Desktop rail — the same destinations with room to breathe. */
export function SideNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Game navigation"
      className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-white/10 bg-navy-950/80 px-4 py-8 backdrop-blur-xl lg:flex"
    >
      <span className="mb-8 px-3 font-display text-lg font-bold tracking-[0.16em] text-white">
        CUE<span className="text-teal">POINT</span>
      </span>
      <ul className="flex flex-col gap-1">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium transition-colors",
                  active
                    ? "bg-teal/12 text-teal ring-1 ring-teal/25"
                    : "text-mist hover:bg-white/[0.04] hover:text-white",
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
