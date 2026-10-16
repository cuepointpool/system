"use client";

import { useSyncExternalStore } from "react";
import { SITE } from "@/lib/config";

const noop = () => () => {};

/**
 * The email address, shown only once the page runs in a browser, so it
 * never sits in the page's HTML as plain text, where spam bots harvest
 * addresses. Until then (and without JavaScript) it reads "Email us".
 */
export function EmailLink({ className }: { className?: string }) {
  const inBrowser = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const address = inBrowser ? SITE.email : null;
  return (
    <a
      href={address ? `mailto:${address}` : "#visit"}
      className={className}
      onClick={(e) => {
        if (!address) e.preventDefault();
      }}
    >
      {address ?? "Email us"}
    </a>
  );
}
