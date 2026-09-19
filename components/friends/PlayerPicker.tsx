"use client";

import { useEffect, useState } from "react";
import { PlayerAvatar } from "@/components/eco/Primitives";
import { apiGet } from "./api";

export interface PickedPlayer {
  id: string;
  slug: string;
  nickname: string;
  avatar: string | null;
  isYou?: boolean;
}

/**
 * Search registered players by nickname/handle and pick one. If the friend
 * isn't registered yet, point the organizer at the sign-up page.
 */
export function PlayerPicker({
  exclude,
  onPick,
  placeholder = "Search players by name…",
  disabled,
}: {
  exclude: Set<string>;
  onPick: (p: PickedPlayer) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  // results are tagged with the term they answer, so a stale answer is never shown
  const [res, setRes] = useState<{ term: string; hits: PickedPlayer[]; error: string | null } | null>(
    null,
  );
  const term = q.trim();

  useEffect(() => {
    if (term.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await apiGet<{ players: PickedPlayer[] }>(
        `/api/friends/players?q=${encodeURIComponent(term)}`,
      );
      if (cancelled) return;
      setRes({ term, hits: r.ok ? r.data.players : [], error: r.ok ? null : r.error });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term]);

  const current = res && res.term === term ? res : null;
  const hits = current?.hits ?? [];
  const error = current?.error ?? null;
  const searched = !!current;
  const visible = hits.filter((h) => !exclude.has(h.id));

  return (
    <div>
      <input
        type="search"
        value={q}
        disabled={disabled}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-mist/60 focus:border-[#a78bfa]/60 focus:outline-none disabled:opacity-50"
      />
      {term.length >= 2 && (
        <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-navy-900/80">
          {error && <p className="px-4 py-3 text-sm text-red-300">{error}</p>}
          {!error &&
            visible.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  onPick(h);
                  setQ("");
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
              >
                <PlayerAvatar name={h.nickname} src={h.avatar} size="xs" />
                <span className="flex-1 text-sm text-white">
                  {h.nickname}
                  {h.isYou && <span className="ml-1.5 text-[11px] text-mist">(you)</span>}
                </span>
                <span className="text-[11px] text-mist">@{h.slug}</span>
                <span className="text-xs font-semibold text-[#c4b5fd]">Add</span>
              </button>
            ))}
          {!error && searched && visible.length === 0 && (
            <div className="px-4 py-3 text-sm text-mist">
              {hits.length > 0
                ? "Everyone matching is already added."
                : "No registered player found. "}
              {hits.length === 0 && (
                <>
                  Ask your friend to register at{" "}
                  <a href="/account" target="_blank" rel="noreferrer" className="text-[#c4b5fd] underline">
                    /account
                  </a>{" "}
                  (or have staff create their account at the counter), then search again.
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
