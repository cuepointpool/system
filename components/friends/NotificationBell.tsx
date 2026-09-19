"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "./api";
import { useLive } from "./live";

/** Navbar bell: unread friend-play notifications, updated live. Players only. */
export function NotificationBell({ onNavigate }: { onNavigate?: () => void }) {
  const [unread, setUnread] = useState(0);

  const refetch = useCallback(async () => {
    const r = await apiGet<{ unread: number }>("/api/friends/notifications");
    if (r.ok) setUnread(r.data.unread);
  }, []);

  useLive(["user"], refetch);
  useEffect(() => {
    const t = setTimeout(() => void refetch(), 0);
    return () => clearTimeout(t);
  }, [refetch]);

  return (
    <Link
      href="/play?tab=notifications"
      onClick={onNavigate}
      aria-label={unread ? `${unread} unread notifications` : "Notifications"}
      className="relative grid h-10 w-10 place-items-center rounded-xl glass text-white transition-transform hover:scale-105"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-[linear-gradient(120deg,#a78bfa,#ec4899)] px-1 text-[10px] font-bold text-navy-950">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
