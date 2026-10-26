"use client";

import { useEffect, useRef, useState } from "react";
import { cn, label12h } from "@/lib/utils";

/* A tap-friendly time picker for the day book: one tap for the hour,
   one for the minutes. Hours run across the business day, 12 PM through
   the night to 6 AM (6:00 AM itself is offered as the latest out time).
   Value is "HH:MM" (24h), same as <input type="time">. */

const HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5];
/** Closing time: an out time can be exactly 6:00 AM, nothing later. */
const CLOSE_HOUR = 6;
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
/** Quick lengths offered on the out-time picker, in minutes after the in time. */
const QUICK = [30, 60, 90, 120, 180];

const pad = (n: number) => String(n).padStart(2, "0");
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? "pm" : "am"}`;

function addMinutes(t: string, mins: number): string {
  const [h, m] = t.split(":").map(Number);
  const total = (h * 60 + m + mins + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function nowRounded(): string {
  const d = new Date();
  const total = Math.round((d.getHours() * 60 + d.getMinutes()) / 5) * 5;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}

const lengthLabel = (m: number) => (m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`);

export function TimeField({
  value,
  onChange,
  placeholder = "Pick time",
  from,
  align = "left",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** set on the out-time field: offers "+1h"-style shortcuts from this time */
  from?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [h, m] = value ? value.split(":").map(Number) : [null, null];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const pick = (v: string, done = false) => {
    onChange(v);
    if (done) setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "input flex h-11 items-center justify-between text-left",
          open && "border-teal/70 bg-teal/[0.06]",
        )}
      >
        <span className={cn("font-display text-base font-semibold tabular-nums", !value && "font-normal text-mist/50")}>
          {value ? label12h(value) : placeholder}
        </span>
        <span className="text-xs text-mist" aria-hidden>
          🕒
        </span>
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-full z-30 mt-2 w-[min(320px,calc(100vw-40px))] rounded-2xl border border-white/15 bg-navy-900 p-3.5 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {from && (
            <div className="mb-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-wide text-mist">Played for</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK.map((q) => {
                  const v = addMinutes(from, q);
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => pick(v, true)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium",
                        value === v ? "border-teal bg-teal text-navy-950" : "border-teal/30 bg-teal/10 text-teal hover:bg-teal/20",
                      )}
                    >
                      {lengthLabel(q)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-mist">Hour</p>
          <div className="grid grid-cols-6 gap-1">
            {(from ? [...HOURS, CLOSE_HOUR] : HOURS).map((hr) => (
              <button
                key={hr}
                type="button"
                onClick={() => pick(`${pad(hr)}:${pad(hr === CLOSE_HOUR ? 0 : (m ?? 0))}`)}
                className={cn(
                  "rounded-lg py-2 text-xs font-medium tabular-nums transition",
                  h === hr ? "bg-teal text-navy-950" : "bg-white/[0.05] text-white/85 hover:bg-white/10",
                )}
              >
                {hourLabel(hr)}
              </button>
            ))}
          </div>

          <p className="mb-1.5 mt-3 text-[10px] uppercase tracking-wide text-mist">Minutes</p>
          <div className="grid grid-cols-6 gap-1">
            {MINUTES.map((mn) => (
              <button
                key={mn}
                type="button"
                disabled={h === null || (h === CLOSE_HOUR && mn !== 0)}
                onClick={() => pick(`${pad(h!)}:${pad(mn)}`, true)}
                className={cn(
                  "rounded-lg py-2 text-xs font-medium tabular-nums transition disabled:opacity-30",
                  m === mn && h !== null ? "bg-teal text-navy-950" : "bg-white/[0.05] text-white/85 hover:bg-white/10",
                )}
              >
                :{pad(mn)}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
            <button type="button" onClick={() => pick(nowRounded(), true)} className="text-xs font-medium text-teal hover:underline">
              Now
            </button>
            {value && (
              <button type="button" onClick={() => pick("", true)} className="text-xs text-mist hover:text-white">
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
