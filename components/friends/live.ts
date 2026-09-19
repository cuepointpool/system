"use client";

/* ============================================================
   Client side of the real-time layer.

   ONE EventSource per tab, shared by every component that asks for
   updates (navbar bell, hub, a game lobby…). The stream only says
   "topic X changed"; components respond by refetching the
   authoritative view from the server — never by patching local state.

   Reliability:
   · every (re)connect refetches, so events missed while offline can't
     leave a stale screen
   · if the stream is down, listeners poll every 20s
   · coming back to the tab, or the network, refetches too
   ============================================================ */

import { useCallback, useEffect, useRef } from "react";

interface Listener {
  topics: Set<string>;
  cb: () => void;
}

const listeners = new Set<Listener>();
let es: EventSource | null = null;
let openKey = "";
let hellos = 0;
let connected = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let wired = false;

const POLL_MS = 20_000;

function fireAll() {
  for (const l of [...listeners]) l.cb();
}

function detailTopics(): string {
  const s = new Set<string>();
  for (const l of listeners) for (const t of l.topics) if (t !== "user") s.add(t);
  return [...s].sort().join(",");
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(fireAll, POLL_MS);
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function closeStream() {
  es?.close();
  es = null;
  openKey = "";
  connected = false;
}

function sync() {
  if (typeof window === "undefined") return;
  if (listeners.size === 0) {
    closeStream();
    stopPolling();
    return;
  }
  const key = detailTopics();
  if (es && es.readyState !== EventSource.CLOSED && key === openKey) return;

  closeStream();
  openKey = key;
  const source = new EventSource(`/api/friends/stream?topics=${encodeURIComponent(key)}`);
  es = source;
  source.addEventListener("hello", () => {
    connected = true;
    stopPolling();
    // the first hello matches the server-rendered snapshot; later ones may
    // follow a gap, so refetch
    if (hellos++ > 0) fireAll();
  });
  source.addEventListener("change", (e) => {
    let topics: string[] = [];
    try {
      topics = (JSON.parse((e as MessageEvent).data) as { topics: string[] }).topics;
    } catch {
      return;
    }
    if (topics.includes("*")) {
      // the server's own database listener reconnected — anything could have changed
      fireAll();
      return;
    }
    for (const l of [...listeners]) {
      if (topics.some((t) => l.topics.has(t) || (l.topics.has("user") && t.startsWith("user:"))))
        l.cb();
    }
  });
  source.onerror = () => {
    connected = false;
    startPolling();
    // a closed source (401/500) never retries by itself
    if (source.readyState === EventSource.CLOSED) {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        if (es === source) {
          closeStream();
          scheduleSync();
        }
      }, 10_000);
    }
  };
}

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  // debounce so a page transition (unmount + mount) doesn't churn the stream
  syncTimer = setTimeout(sync, 60);
}

function wireGlobalEvents() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") fireAll();
  });
  window.addEventListener("online", () => {
    fireAll();
    scheduleSync();
  });
}

/**
 * Call `onChange` whenever one of `topics` changes on the server.
 * Topic "user" means "anything that concerns me" (invitations, lists,
 * notifications); `game:<id>` / `tournament:<id>` are detail topics.
 */
export function useLive(topics: string[], onChange: () => void) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  const key = topics.join(",");
  useEffect(() => {
    wireGlobalEvents();
    const l: Listener = {
      topics: new Set(key ? key.split(",") : []),
      cb: () => cb.current(),
    };
    listeners.add(l);
    scheduleSync();
    return () => {
      listeners.delete(l);
      scheduleSync();
    };
  }, [key]);
}

/**
 * Guards a refetch against out-of-order responses: call the returned
 * function when a request starts; the function IT returns tells you whether
 * that request is still the newest one.
 */
export function useRequestGuard() {
  const seq = useRef(0);
  return useCallback(() => {
    const mine = ++seq.current;
    return () => mine === seq.current;
  }, []);
}

/** true while the stream is connected (for the small "Live" indicator) */
export function isLiveConnected(): boolean {
  return connected;
}
