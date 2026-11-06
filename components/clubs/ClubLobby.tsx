"use client";

import { useEffect } from "react";
import { TournamentLobby } from "@/components/friends/TournamentLobby";
import { isActingAsClub, setActAsClub } from "@/components/friends/api";
import type { TournamentView } from "@/lib/friends/types";

let mounted = 0;

/**
 * A club league's page. When the club's own admin is viewing, every
 * request from the lobby runs as the club (the organizer) — set before
 * the children's first effects, which run before this component's own.
 */
export function ClubLobby({ initial, meId, asClub }: { initial: TournamentView; meId: string; asClub: boolean }) {
  if (typeof window !== "undefined" && isActingAsClub() !== asClub) setActAsClub(asClub);
  useEffect(() => {
    setActAsClub(asClub);
    mounted++;
    return () => {
      mounted--;
      // deferred: a StrictMode remount (or the next club page) keeps it on;
      // leaving club pages switches it off
      queueMicrotask(() => {
        if (!mounted) setActAsClub(false);
      });
    };
  }, [asClub]);
  return <TournamentLobby initial={initial} meId={meId} />;
}
