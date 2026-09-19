"use client";

import { useCallback, useState } from "react";
import { apiGet } from "./api";
import { useLive, useRequestGuard } from "./live";

/**
 * A server-rendered snapshot that stays current. The stream only says
 * "something changed"; this refetches the authoritative view and keeps it
 * only if it isn't older than what's on screen (compared by `version`).
 */
export function useLiveView<T extends { version: number }>(
  initial: T,
  url: string,
  field: "game" | "tournament",
  topics: string[],
) {
  const [data, setData] = useState(initial);
  const [gone, setGone] = useState(false);
  const guard = useRequestGuard();

  const refetch = useCallback(async () => {
    const isCurrent = guard();
    const r = await apiGet<Record<string, T>>(url);
    if (!isCurrent()) return; // a newer request is already in flight
    if (r.status === 404 || r.status === 401) {
      setGone(true);
      return;
    }
    if (r.ok) {
      const next = r.data[field];
      setGone(false);
      setData((prev) => (next.version >= prev.version ? next : prev));
    }
  }, [url, field, guard]);

  useLive(topics, refetch);
  return { data, refetch, gone };
}
