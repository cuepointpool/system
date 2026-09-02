"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { TABLE_HOURLY_RATE } from "@/lib/config";
import { formatLKR } from "@/lib/utils";
import { BookingOpenNote } from "./BookingOpenNote";
import { Reveal } from "./Reveal";

const STEPS = ["Table", "Time", "Details", "Confirm"] as const;

export type FloorTableOption = {
  id: string;
  label: string;
  area: string;
  note: string;
  seats: number;
  bookable: boolean;
};

const ASSURANCES = [
  { icon: "shield", t: "Instant confirmation", d: "No waiting, just play." },
  { icon: "calcheck", t: "Live availability", d: "Real-time table updates." },
  { icon: "ticket", t: "Show & play", d: "Reference at the counter." },
  { icon: "lock", t: "No account needed", d: "Book quick. Play easy." },
] as const;

const firstBookable = (list: FloorTableOption[]) =>
  (list.find((t) => t.bookable) ?? list[0])?.id ?? "";

export function Tables({ tables: initial = [] }: { tables?: FloorTableOption[] }) {
  const [tables, setTables] = useState<FloorTableOption[]>(initial);
  const [tableId, setTableId] = useState<string>(firstBookable(initial));
  const [hours, setHours] = useState(2);
  const [players, setPlayers] = useState(2);

  useEffect(() => {
    if (initial.length) return;
    let alive = true;
    fetch("/api/tables", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !Array.isArray(d.tables)) return;
        setTables(d.tables as FloorTableOption[]);
        setTableId((id) => id || firstBookable(d.tables as FloorTableOption[]));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [initial.length]);

  const table = useMemo(
    () =>
      tables.find((t) => t.id === tableId) ??
      tables.find((t) => t.bookable) ??
      tables[0],
    [tables, tableId],
  );
  const total = TABLE_HOURLY_RATE * hours;

  function pick(id: string) {
    const next = tables.find((t) => t.id === id);
    if (!next || !next.bookable) return; // view-only tables are booked by phone
    setTableId(id);
    setPlayers((p) => Math.min(p, next.seats));
  }

  return (
    <section
      id="tables"
      className="relative isolate overflow-hidden bg-navy-950 py-20 sm:py-28 md:py-32"
    >
      <div className="absolute inset-0 -z-10">
        <Image
          src="/media/book-bg.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center opacity-[0.65]"
        />
        <div className="absolute inset-0 bg-navy-950/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950 via-navy-950/55 to-navy-950" />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 md:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.34em] text-teal">
            Book in 4 taps
          </span>
          <h2 className="mt-4 font-display text-4xl font-bold leading-[1.02] text-white md:text-5xl">
            Your table, <span className="text-teal-gradient">waiting for you</span>
          </h2>
          <p className="mt-4 text-mist">
            Live availability, instant confirmation, a reference to show at the
            counter.
          </p>
          <BookingOpenNote tables={tables} />
        </Reveal>

        <Reveal className="mt-12">
          <div className="grid gap-5 lg:grid-cols-3">
            {/* ---- picker ---- */}
            <div className="rounded-[24px] border border-white/[0.06] bg-navy-900/60 p-6 backdrop-blur-md sm:p-8 lg:col-span-2">
              <ol className="flex items-center gap-1 overflow-x-auto pb-1 hide-scrollbar">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full border text-[11px] font-bold ${
                        i === 0
                          ? "border-teal bg-teal/15 text-teal"
                          : "border-white/[0.1] text-mist"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                        i === 0 ? "text-white" : "hidden text-mist sm:inline"
                      }`}
                    >
                      {s}
                    </span>
                    {i < STEPS.length - 1 && (
                      <span className="mx-1 h-px w-4 bg-white/15 sm:mx-1.5 sm:w-8" />
                    )}
                  </li>
                ))}
              </ol>

              <h3 className="mt-7 font-display text-xl font-bold text-white">
                Which table?
              </h3>
              <p className="mt-1 text-sm text-mist">
                Pick the felt you want to play on.
              </p>

              <div className="mt-5 space-y-3">
                {tables.length === 0 && (
                  <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-mist">
                    Loading tables…
                  </p>
                )}
                {tables.map((t, i) => {
                  const active = t.id === tableId;
                  const phoneOnly = !t.bookable;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => pick(t.id)}
                      disabled={phoneOnly}
                      aria-pressed={active}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors sm:gap-4 sm:p-4 ${
                        phoneOnly
                          ? "cursor-default border-white/[0.05] bg-white/[0.01] opacity-60"
                          : active
                            ? "border-teal/60 bg-teal/[0.07] ring-1 ring-teal/40"
                            : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                      }`}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[linear-gradient(150deg,#0c6b5f,#063f39)] font-display text-base font-bold text-white/90 sm:h-11 sm:w-11 sm:text-lg">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-sm font-bold text-white sm:text-[15px]">
                          {t.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-mist sm:text-xs">
                          <span className="sm:hidden">{t.area}</span>
                          <span className="hidden sm:inline">
                            {t.area}
                            {t.note ? ` · ${t.note}` : ""}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        {phoneOnly ? (
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-mist sm:text-[11px]">
                            By phone
                          </span>
                        ) : (
                          <>
                            <span className="block font-display text-sm font-bold text-white sm:text-[15px]">
                              {formatLKR(TABLE_HOURLY_RATE)}
                            </span>
                            <span className="block text-[10px] text-mist sm:text-[11px]">
                              / hour
                            </span>
                          </>
                        )}
                      </span>
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                          phoneOnly
                            ? "border-white/[0.08]"
                            : active
                              ? "border-teal bg-teal text-navy-950"
                              : "border-white/[0.14]"
                        }`}
                      >
                        {active && !phoneOnly && (
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
                            <path
                              d="M3 8.5l3.2 3.2L13 5"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Stepper
                  label="Length"
                  value={hours}
                  format={(v) => `${v} hour${v > 1 ? "s" : ""}`}
                  min={1}
                  max={5}
                  onChange={setHours}
                />
                <Stepper
                  label="Players"
                  value={players}
                  format={(v) => String(v)}
                  min={1}
                  max={table?.seats ?? 8}
                  onChange={setPlayers}
                />
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled
                  className="rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-mist/50"
                >
                  Back
                </button>
                <Link
                  href={table ? `/book?table=${table.id}` : "/book"}
                  className="inline-flex items-center gap-2 rounded-full bg-teal px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-950 transition-colors hover:bg-teal-bright"
                >
                  Continue
                  <span aria-hidden>&rarr;</span>
                </Link>
              </div>
            </div>

            {/* ---- session summary ---- */}
            <div className="rounded-[24px] border border-white/[0.08] bg-navy-900/70 p-6 backdrop-blur-md sm:p-7 lg:self-start">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal">
                Your session
              </span>
              <dl className="mt-5 space-y-3.5 text-sm">
                <SummaryRow icon="table" k="Table" v={table?.label ?? "—"} />
                <SummaryRow icon="calendar" k="Day" v="—" />
                <SummaryRow icon="clock" k="Time" v="—" />
                <SummaryRow
                  icon="timer"
                  k="Length"
                  v={`${hours} hour${hours > 1 ? "s" : ""}`}
                />
                <SummaryRow icon="people" k="Players" v={String(players)} />
              </dl>

              <div className="my-5 border-t border-white/[0.08]" />

              <div className="flex items-end justify-between">
                <span className="text-sm text-mist">Total</span>
                <span className="font-display text-3xl font-bold text-teal-bright">
                  {formatLKR(total)}
                </span>
              </div>
              <p className="mt-2 text-xs text-mist">
                {formatLKR(TABLE_HOURLY_RATE)} / hour · Pay at the counter
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-5">
          <ul className="grid grid-cols-2 gap-5 rounded-[20px] border border-white/[0.06] bg-navy-900/50 p-5 backdrop-blur-md sm:grid-cols-4 sm:gap-2 sm:p-6">
            {ASSURANCES.map((a) => (
              <li
                key={a.t}
                className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-start sm:gap-3 sm:border-l sm:border-white/[0.06] sm:px-4 sm:text-left sm:first:border-l-0"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-teal/30 text-teal">
                  <MiniIcon name={a.icon} />
                </span>
                <span>
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-teal">
                    {a.t}
                  </span>
                  <span className="mt-0.5 block text-xs text-mist">{a.d}</span>
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function Stepper({
  label,
  value,
  format,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-mist">
        {label}
      </span>
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid h-7 w-7 place-items-center rounded-full border border-white/[0.1] text-white transition-colors hover:border-teal hover:text-teal disabled:opacity-30"
          disabled={value <= min}
        >
          &minus;
        </button>
        <span className="font-display text-sm font-bold text-white">
          {format(value)}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid h-7 w-7 place-items-center rounded-full border border-white/[0.1] text-white transition-colors hover:border-teal hover:text-teal disabled:opacity-30"
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ icon, k, v }: { icon: string; k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-2.5 text-mist">
        <span className="text-teal">
          <MiniIcon name={icon} />
        </span>
        {k}
      </dt>
      <dd className="font-display font-semibold text-white">{v}</dd>
    </div>
  );
}

function MiniIcon({ name }: { name: string }) {
  const p = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "table":
      return (
        <svg {...p}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 12h18" />
          <circle cx="7.5" cy="9" r="0.7" fill="currentColor" />
          <circle cx="16.5" cy="15" r="0.7" fill="currentColor" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...p}>
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M4 10h16M8 3v4M16 3v4" />
        </svg>
      );
    case "clock":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4.5l3 2" />
        </svg>
      );
    case "timer":
      return (
        <svg {...p}>
          <circle cx="12" cy="13" r="7" />
          <path d="M12 13V9M9 2h6M18.5 6.5l-1.8 1.8" />
        </svg>
      );
    case "people":
      return (
        <svg {...p}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 6a3 3 0 0 1 0 6M15.5 20a5.5 5.5 0 0 1 5-5" />
        </svg>
      );
    case "shield":
      return (
        <svg {...p}>
          <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "calcheck":
      return (
        <svg {...p}>
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M4 10h16M8 3v4M16 3v4M9 15l2 2 4-4" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...p}>
          <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" />
          <path d="M13 6v2M13 12v2" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      );
  }
}
