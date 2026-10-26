"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ErrorNote, useAccounts } from "./ui";

/* An investor's signature for signed statements: upload a photo (white
   paper background is removed automatically) or a transparent PNG, or draw
   it on screen. Always saved as a trimmed, transparent PNG. */

const MAX_W = 900;
const MAX_H = 300;

/** Checkerboard so transparency is visible. */
export const CHECKER = {
  backgroundColor: "#fff",
  backgroundImage:
    "linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)",
  backgroundSize: "14px 14px",
  backgroundPosition: "0 0,0 7px,7px -7px,-7px 0",
};

/** Crop a canvas to its visible ink (plus padding) and return a PNG data URL. */
function trimToPng(src: HTMLCanvasElement): string | null {
  const ctx = src.getContext("2d")!;
  const { width: w, height: h } = src;
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const pad = 8;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d")!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

/** Load an image file, optionally knock out a light (paper) background. */
async function processFile(file: File, removeBg: boolean): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Could not read that image"));
      i.src = url;
    });
    const scale = Math.min(1, MAX_W / img.width, MAX_H / img.height);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    if (removeBg) {
      const data = ctx.getImageData(0, 0, c.width, c.height);
      const p = data.data;
      for (let i = 0; i < p.length; i += 4) {
        const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
        // paper → clear, ink → solid, a soft edge in between
        const a = lum >= 200 ? 0 : lum <= 140 ? 255 : Math.round(((200 - lum) / 60) * 255);
        p[i + 3] = Math.min(p[i + 3], a);
      }
      ctx.putImageData(data, 0, 0);
    }
    return trimToPng(c);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function hasTransparency(file: File): Promise<boolean> {
  if (file.type !== "image/png") return Promise.resolve(false);
  return new Promise((res) => {
    const i = new Image();
    const url = URL.createObjectURL(file);
    i.onload = () => {
      const c = document.createElement("canvas");
      c.width = Math.min(200, i.width);
      c.height = Math.min(200, i.height);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(i, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let clear = false;
      for (let k = 3; k < d.length; k += 4) if (d[k] < 250) { clear = true; break; }
      URL.revokeObjectURL(url);
      res(clear);
    };
    i.onerror = () => res(false);
    i.src = url;
  });
}

export function SignatureEditor({ partnerId, isSelf }: { partnerId: string; isSelf: boolean }) {
  const { headers, reloadMeta } = useAccounts();
  const [current, setCurrent] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const q = isSelf ? "" : `?id=${encodeURIComponent(partnerId)}`;
  const hk = JSON.stringify(headers);

  const load = useCallback(() => {
    fetch(`/api/accounts/signature${q}`, { headers: JSON.parse(hk), cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCurrent(d.image ?? null))
      .catch(() => setCurrent(null));
  }, [q, hk]);
  useEffect(() => load(), [load]);

  const pick = async (f: File | undefined, strip?: boolean) => {
    if (!f) return;
    setErr(null);
    try {
      const auto = strip ?? !(await hasTransparency(f));
      setRemoveBg(auto);
      setLastFile(f);
      const png = await processFile(f, auto);
      if (!png) return setErr("No signature found in that image");
      setDraft(png);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not read that image");
    }
  };

  const save = async (image: string | null) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/accounts/signature", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ...(isSelf ? {} : { id: partnerId }), image }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      setDraft(null);
      setDrawing(false);
      load();
      reloadMeta();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const shown = draft ?? current;

  return (
    <div className="rounded-xl bg-black/20 p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-white">Signature</p>
        {current && !draft && !drawing && (
          <button disabled={busy} onClick={() => confirm("Remove this signature?") && save(null)} className="text-[10px] text-rose-300/80 hover:text-rose-200">
            Remove
          </button>
        )}
      </div>

      {drawing ? (
        <DrawPad onCancel={() => setDrawing(false)} onDone={(png) => (setDrawing(false), setDraft(png))} />
      ) : (
        <div className="mt-2 grid h-24 place-items-center overflow-hidden rounded-lg border border-white/10" style={CHECKER}>
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Signature" className="max-h-20 max-w-[90%] object-contain" />
          ) : (
            <span className="text-[11px] text-slate-500">{current === undefined ? "Loading…" : "No signature yet"}</span>
          )}
        </div>
      )}

      {draft ? (
        <div className="mt-3 space-y-2">
          {lastFile && (
            <label className="flex items-center gap-2 text-[11px] text-mist">
              <input
                type="checkbox"
                className="h-3 w-3 accent-teal"
                checked={removeBg}
                onChange={(e) => pick(lastFile, e.target.checked)}
              />
              Remove white background
            </label>
          )}
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => save(draft)} className="btn-primary px-4 py-1.5 text-xs disabled:opacity-40">
              {busy ? "Saving…" : "Use this signature"}
            </button>
            <button onClick={() => (setDraft(null), setLastFile(null))} className="btn-ghost px-3 py-1.5 text-xs">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        !drawing && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="btn-ghost cursor-pointer px-3 py-1.5 text-xs">
              {current ? "Replace" : "Upload"} image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  pick(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <button onClick={() => setDrawing(true)} className="btn-ghost px-3 py-1.5 text-xs">
              Draw it
            </button>
          </div>
        )
      )}
      <p className="mt-2 text-[10px] leading-relaxed text-mist">
        Sign on white paper and take a photo — the background is removed automatically. A transparent PNG works too.
      </p>
      <div className="mt-2">
        <ErrorNote text={err} />
      </div>
    </div>
  );
}

function DrawPad({ onDone, onCancel }: { onDone: (png: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [inked, setInked] = useState(false);

  useEffect(() => {
    const c = ref.current!;
    c.width = 900;
    c.height = 300;
    const ctx = c.getContext("2d")!;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b1f33";
    ctx.lineWidth = 5;
  }, []);

  const at = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 900, y: ((e.clientY - r.top) / r.height) * 300 };
  };

  return (
    <div className="mt-2">
      <canvas
        ref={ref}
        className="h-28 w-full touch-none rounded-lg border border-white/10 bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          last.current = at(e);
        }}
        onPointerMove={(e) => {
          if (!last.current) return;
          const p = at(e);
          const ctx = ref.current!.getContext("2d")!;
          ctx.beginPath();
          ctx.moveTo(last.current.x, last.current.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          last.current = p;
          setInked(true);
        }}
        onPointerUp={() => (last.current = null)}
        onPointerLeave={() => (last.current = null)}
      />
      <div className="mt-2 flex gap-2">
        <button
          disabled={!inked}
          onClick={() => {
            const png = trimToPng(ref.current!);
            if (png) onDone(png);
          }}
          className={cn("btn-primary px-4 py-1.5 text-xs", !inked && "opacity-40")}
        >
          Done
        </button>
        <button
          onClick={() => {
            ref.current!.getContext("2d")!.clearRect(0, 0, 900, 300);
            setInked(false);
          }}
          className="btn-ghost px-3 py-1.5 text-xs"
        >
          Clear
        </button>
        <button onClick={onCancel} className="btn-ghost px-3 py-1.5 text-xs">
          Cancel
        </button>
      </div>
    </div>
  );
}
