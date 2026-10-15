"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "./Primitives";

/* ------------------------------------------------------------------
   The signed-in player's own avatar with a "change photo" control.
   The picked image is centre-cropped to a square and shrunk in the
   browser before upload, so the server only ever stores ~30 KB.
   ------------------------------------------------------------------ */

const OUT_PX = 320;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't an image we can read."));
    };
    img.src = url;
  });
}

async function squareDataUrl(file: File): Promise<string> {
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = OUT_PX;
  canvas.height = OUT_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images.");
  ctx.drawImage(
    img,
    (img.naturalWidth - side) / 2,
    (img.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    OUT_PX,
    OUT_PX,
  );
  const webp = canvas.toDataURL("image/webp", 0.85);
  // Safari without WebP encoding falls back to PNG — use JPEG instead
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
}

export function AvatarUpload({
  name,
  src,
  size = "lg",
  ring,
  className,
  avatarClassName,
  compact = false,
}: {
  name: string;
  src: string | null;
  size?: "lg" | "xl";
  ring?: boolean;
  className?: string;
  avatarClassName?: string;
  /** no "Remove photo" link and no layout shift — for avatars inside a ring */
  compact?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(src);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error("That photo is too large.");
      const image = await squareDataUrl(file);
      const res = await fetch("/api/me/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save the photo.");
      setCurrent(d.avatar);
      window.dispatchEvent(new Event("cp:avatar"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the photo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/me/avatar", { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setError("Could not remove the photo.");
    setCurrent(null);
    window.dispatchEvent(new Event("cp:avatar"));
    router.refresh();
  }

  return (
    <div className={cn("relative flex flex-col items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label="Change profile photo"
        className="group relative rounded-full"
      >
        <PlayerAvatar name={name} src={current} size={size} ring={ring} className={avatarClassName} />
        <span
          className={cn(
            "absolute inset-0 grid place-items-center rounded-full bg-black/55 text-[11px] font-semibold text-white transition-opacity",
            busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
          )}
        >
          {busy ? "Saving…" : "Change"}
        </span>
        {/* always-visible camera badge for touch screens */}
        <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full border-2 border-navy-950 bg-teal text-navy-950">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) upload(f);
        }}
      />
      {current && !busy && !compact && (
        <button type="button" onClick={remove} className="text-[10px] text-mist hover:text-white">
          Remove photo
        </button>
      )}
      {error && (
        <p
          className={cn(
            "max-w-[12rem] text-center text-[11px] text-rose-300",
            compact && "absolute left-1/2 top-full z-10 mt-8 w-48 -translate-x-1/2 rounded-lg bg-navy-950/95 px-2 py-1",
          )}
        >
          {error}
        </p>
      )}
    </div>
  );
}
