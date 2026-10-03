"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { SITE, TABLE_HOURLY_RATE } from "@/lib/config";
import { formatLKR } from "@/lib/utils";
import { Reveal } from "./Reveal";
import { SectionKicker } from "@/components/BrandMark";

export type FloorTableOption = {
  id: string;
  label: string;
  area: string;
  note: string;
  seats: number;
  bookable: boolean;
};

const ASSURANCES = [
  "Live availability, so you only see slots that are free",
  "Confirmed straight away, with a reference to show at the counter",
  "Online booking is for members, and joining is free",
  "Prefer to call? Any table can be booked by phone",
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
  const phoneOnlyCount = tables.filter((t) => !t.bookable).length;
  const onlineLabels = tables
    .filter((t) => t.bookable)
    .map((t) => t.label)
    .join(", ");

  function pick(id: string) {
    const next = tables.find((t) => t.id === id);
    if (!next || !next.bookable) return; // view-only tables are booked by phone
    setTableId(id);
    setPlayers((p) => Math.min(p, next.seats));
  }

  return (
    <section id="tables" className="relative isolate overflow-hidden bg-navy-950 py-20 sm:py-28">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/media/story/book-bg.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-navy-950/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950/90 via-navy-950/40 to-transparent" />
      </div>

      <div className="grid gap-10 px-5 md:px-8 lg:grid-cols-[1fr_minmax(0,600px)] lg:items-center lg:gap-16 lg:px-12">
        {/* ---- the pitch ---- */}
        <Reveal>
          <SectionKicker>
            Book a table
          </SectionKicker>
          <h2 className="mt-3 font-display text-3xl font-bold leading-[1.05] text-white sm:text-4xl md:text-5xl">
            Your table, waiting for you
          </h2>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/85">
            Pick a table here, choose your day and time on the next screen, and
            it is yours when you walk in.
          </p>

          <ul className="mt-7 space-y-3">
            {ASSURANCES.map((a) => (
              <li key={a} className="flex items-start gap-3 text-[15px] text-white">
                <svg viewBox="0 0 24 24" className="mt-1 h-4 w-4 shrink-0 text-teal" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                {a}
              </li>
            ))}
          </ul>
        </Reveal>

        {/* ---- the picker ---- */}
        <Reveal delay={0.08}>
          <div className="rounded-lg bg-navy-900 p-5 sm:p-7">
            <h3 className="font-display text-xl font-bold text-white">Which table?</h3>
            {phoneOnlyCount > 0 && (
              <p className="mt-2 text-sm leading-relaxed text-white/85">
                Online booking is open for{" "}
                <span className="font-semibold text-teal-bright">
                  {onlineLabels || "no tables right now"}
                </span>{" "}
                only. To book any table, call{" "}
                <a href={SITE.phoneHref} className="font-semibold text-white underline underline-offset-4">
                  {SITE.phone}
                </a>
                .
              </p>
            )}

            <div className="mt-4 space-y-2.5">
              {tables.length === 0 && (
                <p className="rounded-md border border-white/10 p-4 text-sm text-mist">
                  Loading tables…
                </p>
              )}
              {tables.map((t, i) => {
                const active = t.id === tableId;
                const phoneOnly = !t.bookable;
                if (phoneOnly)
                  return (
                    <a
                      key={t.id}
                      href={SITE.phoneHref}
                      className="flex w-full items-center gap-3 rounded-md border border-dashed border-white/20 p-3 text-left transition-colors hover:border-white/40 sm:gap-4 sm:p-4"
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-sm font-bold ${
                          "bg-white/10 text-white"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-[15px] font-bold text-white">
                          {t.label}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-mist">
                          <span className="sm:hidden">{t.area}</span>
                          <span className="hidden sm:inline">
                            {t.area}
                            {t.note ? ` · ${t.note}` : ""}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[12px] font-bold uppercase tracking-[0.08em] text-white underline underline-offset-4">
                          Call to book
                        </span>
                      </span>
                    </a>
                  );
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pick(t.id)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors sm:gap-4 sm:p-4 ${
                      active ? "border-teal bg-teal/10" : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-sm font-bold ${
                        active ? "bg-teal text-navy-950" : "bg-white/10 text-white"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[15px] font-bold text-white">
                        {t.label}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-mist">
                        <span className="sm:hidden">{t.area}</span>
                        <span className="hidden sm:inline">
                          {t.area}
                          {t.note ? ` · ${t.note}` : ""}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-display text-[15px] font-bold text-white">
                            {formatLKR(TABLE_HOURLY_RATE)}
                          </span>
                          <span className="block text-[11px] text-mist">/ hour</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
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

            <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-5">
              <div>
                <span className="block text-xs text-mist">
                  {table?.label ?? "Table"} · {hours} hour{hours > 1 ? "s" : ""} · pay at the counter
                </span>
                <span className="mt-1 block font-display text-3xl font-bold text-white">
                  {formatLKR(total)}
                </span>
              </div>
              <Link
                href={table ? `/book?table=${table.id}` : "/book"}
                className="inline-flex items-center rounded-full bg-white px-6 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-950 transition-colors duration-200 hover:bg-gold"
              >
                Choose day and time
              </Link>
            </div>
          </div>
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
    <div className="rounded-md border border-white/10 px-4 py-3">
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
