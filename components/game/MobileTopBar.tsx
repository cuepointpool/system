"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { BackIcon, CoinIcon } from "./Icons";
import { PlayerAvatar } from "@/components/eco/Primitives";

/**
 * Compact game header: identity on the left, page title centred, wallet +
 * avatar on the right. Deliberately thin — the profile lives behind the
 * avatar tap, not in the header.
 */
export function MobileTopBar({
  title,
  coins,
  level,
  playerName,
  avatar,
  back,
}: {
  title: string;
  coins: number;
  level: number;
  playerName: string;
  avatar?: string | null;
  /** show a back chevron instead of the logo */
  back?: string;
}) {
  const router = useRouter();

  return (
    <header className="fixed inset-x-0 top-0 z-40 pt-safe">
      <div className="bg-gradient-to-b from-navy-950 via-navy-950/95 to-transparent pb-3">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          {back ? (
            <button
              onClick={() => router.push(back)}
              aria-label="Back"
              className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/90 active:bg-white/10"
            >
              <BackIcon className="h-5 w-5" />
            </button>
          ) : (
            <Link href="/campaign" className="shrink-0" aria-label="Cue Point">
              <Image
                src="/media/logo-mark.png"
                alt="Cue Point"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                priority
              />
            </Link>
          )}

          <h1
            className={cn(
              "min-w-0 flex-1 truncate font-display text-[15px] font-bold uppercase tracking-[0.14em] text-white",
              back ? "text-left" : "text-center",
            )}
          >
            {title}
          </h1>

          <div className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-navy-900/80 py-1 pl-1 pr-2.5">
              <CoinIcon className="h-5 w-5" />
              <span className="font-display text-[13px] font-bold tabular-nums text-white">
                {coins.toLocaleString()}
              </span>
            </span>
            <Link href="/profile" aria-label="Your profile" className="relative block">
              <PlayerAvatar name={playerName} src={avatar} size="sm" ring />
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full border border-teal/50 bg-navy-950 px-1.5 text-[9px] font-bold leading-[14px] text-teal">
                {level}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
