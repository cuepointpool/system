"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Notice, PrimaryButton } from "@/components/friends/ui";

/** "Ask to join" on a club page, for a signed-in player who isn't a member */
export function JoinClubButton({ slug, clubName, requested }: { slug: string; clubName: string; requested: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function send(method: "POST" | "DELETE") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clubs/${slug}/join`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify({ message }) : undefined,
    }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) return setError(d.error || "Something went wrong.");
    setOpen(false);
    router.refresh();
  }

  if (requested)
    return (
      <div className="rounded-2xl border border-teal/30 bg-teal/[0.07] p-4">
        <p className="font-semibold text-teal">Request sent ✓</p>
        <p className="mt-1 text-sm text-mist">
          The {clubName} admin will put you in a group. You&apos;ll get a notification.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => send("DELETE")}
          className="mt-2 min-h-[40px] text-sm text-mist underline hover:text-white"
        >
          Cancel my request
        </button>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    );

  return (
    <div className="rounded-2xl border border-[#a78bfa]/40 bg-[#a78bfa]/[0.06] p-4">
      <p className="font-semibold text-white">Want to play for {clubName}?</p>
      <p className="mt-1 text-sm text-mist">Ask to join — the club admin adds you to a group.</p>
      {open ? (
        <div className="mt-3 space-y-3">
          <textarea
            value={message}
            maxLength={200}
            rows={2}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="A short note for the admin (optional) — e.g. how often you play"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder:text-mist/60 focus:border-[#a78bfa]/60 focus:outline-none"
          />
          <PrimaryButton className="w-full py-3 sm:w-auto" disabled={busy} onClick={() => send("POST")}>
            {busy ? "Sending…" : "Send request"}
          </PrimaryButton>
        </div>
      ) : (
        <PrimaryButton className="mt-3 w-full py-3 sm:w-auto" onClick={() => setOpen(true)}>
          Ask to join
        </PrimaryButton>
      )}
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </div>
  );
}
