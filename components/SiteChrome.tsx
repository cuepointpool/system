"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

/**
 * The marketing site's header and footer.
 *
 * Game routes (/campaign, /leaderboard, /profile) render inside the game
 * shell instead — its own top bar and bottom navigation — so the site chrome
 * is suppressed there. Everything else keeps the normal site frame.
 */
const GAME_ROUTES = ["/campaign", "/leaderboard", "/profile"];

function isGameRoute(pathname: string): boolean {
  return GAME_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

export function SiteHeader() {
  const pathname = usePathname();
  return isGameRoute(pathname) ? null : <Navbar />;
}

export function SiteFooter() {
  const pathname = usePathname();
  return isGameRoute(pathname) ? null : <Footer />;
}
