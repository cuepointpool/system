"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrandMark } from "./BrandMark";
import {
  DURATION_OPTIONS,
  OPEN_DAYS_AHEAD,
  SLOT_STEP_MIN,
  TURNOVER_MIN,
  isPastSlot,
  priceFor,
  slotStartsForDate,
} from "@/lib/booking";
import { SITE, TABLE_HALF_HOUR_RATE, TABLE_HOURLY_RATE } from "@/lib/config";
import {
  addDays,
  cn,
  formatLKR,
  label12h,
  minutesToTime,
  timeToMinutes,
  toISODate,
} from "@/lib/utils";

type BookedInterval = {
  start: string;
  end: string;
  startMin: number;
  endMin: number;
};

type FloorTable = {
  id: string;
  label: string;
  area: string;
  note: string;
  seats: number;
  bookable: boolean;
  bookings: BookedInterval[];
};

type FloorAvailability = {
  date: string;
  open: string;
  close: string;
  openMin: number;
  closeMin: number;
  graceMin: number;
  slotStarts: string[];
  tables: FloorTable[];
};

const STEPS = ["Slot", "Details", "Confirm"] as const;
const DEFAULT_DURATION = 2;

const btnPrimary =
  "inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-navy-950 transition-colors duration-200 hover:bg-gold disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50";
const btnSecondary =
  "inline-flex items-center justify-center rounded-full border border-white/40 px-5 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-white transition-colors duration-200 hover:border-white";
const panel = "rounded-lg bg-navy-900";

/** "0.5" → "30 min", "1" → "1h", "1.5" → "1h 30m" */
function durationLabel(h: number): string {
  const whole = Math.floor(h);
  const half = h - whole >= 0.5;
  if (whole === 0) return "30 min";
  return half ? `${whole}h 30m` : `${whole}h`;
}

/** "0.5" → "30 minutes", "1" → "1 hour", "1.5" → "1 hour 30 min" */
function durationLong(h: number): string {
  const whole = Math.floor(h);
  const half = h - whole >= 0.5;
  if (whole === 0) return "30 minutes";
  const hrs = `${whole} hour${whole > 1 ? "s" : ""}`;
  return half ? `${hrs} 30 min` : hrs;
}

/** "Table 1 — The Baize" → ["Table 1", "The Baize"] */
function splitLabel(label: string): [string, string] {
  const [a, ...rest] = label.split(" — ");
  return [a, rest.join(" — ")];
}

export type TableOption = {
  id: string;
  label: string;
  area: string;
  note: string;
  seats: number;
  bookable: boolean;
};

/** minutes from midnight, pushing past-midnight labels into the same session day */
function sessionMin(hhmm: string): number {
  const m = timeToMinutes(hhmm);
  return m < 360 ? m + 1440 : m;
}

function firstOpenDay(): string {
  let d = new Date();
  for (let i = 0; i < 14; i++) {
    const iso = toISODate(d);
    const starts = slotStartsForDate(iso);
    const needSlots = (DEFAULT_DURATION * 60) / SLOT_STEP_MIN;
    const ok = starts.some(
      (s, idx) => !isPastSlot(iso, s) && starts.length - idx >= needSlots,
    );
    if (ok) return iso;
    d = addDays(d, 1);
  }
  return toISODate(new Date());
}

/** a start time is bookable if the whole session + grace stays clear of every
 *  booking on that table, sits inside opening hours, and hasn't passed */
function slotOpen(
  table: FloorTable,
  date: string,
  start: string,
  duration: number,
  closeMin: number,
  graceMin: number,
): boolean {
  if (isPastSlot(date, start)) return false;
  const s = sessionMin(start);
  const e = s + duration * 60;
  if (e > closeMin) return false;
  for (const b of table.bookings) {
    if (s < b.endMin + graceMin && b.startMin < e + graceMin) return false;
  }
  return true;
}

export function BookingWidget({
  initialTable,
  tables: tablesProp,
}: {
  initialTable?: string | null;
  tables?: TableOption[];
  compact?: boolean;
}) {
  const [step, setStep] = useState(0);

  const [date, setDate] = useState<string>(() => firstOpenDay());
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [pickedTableId, setPickedTableId] = useState<string>(initialTable ?? "");
  const [startTime, setStartTime] = useState<string>("");

  const [partySize, setPartySize] = useState(2);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [agreedTurnover, setAgreedTurnover] = useState(false);

  // online booking is members-only: undefined = checking, null = signed out
  const [viewer, setViewer] = useState<
    | { fullName: string; email: string | null; role: string }
    | null
    | undefined
  >(undefined);

  useEffect(() => {
    let alive = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.viewer) {
          setViewer({
            fullName: d.viewer.fullName,
            email: d.viewer.email ?? null,
            role: d.viewer.role,
          });
          if (d.viewer.role === "player") {
            setName((n) => n || d.viewer.fullName || "");
            setEmail((e) => e || d.viewer.email || "");
          }
        } else {
          setViewer(null);
        }
      })
      .catch(() => alive && setViewer(null));
    return () => {
      alive = false;
    };
  }, []);

  const [floor, setFloor] = useState<FloorAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<null | {
    reference: string;
    tableName: string;
    totalAmount: number;
  }>(null);

  const days = useMemo(
    () =>
      Array.from({ length: OPEN_DAYS_AHEAD }, (_, i) =>
        toISODate(addDays(new Date(), i)),
      ),
    [],
  );
  const isToday = date === days[0];

  const tableList: FloorTable[] = useMemo(() => {
    if (floor) return floor.tables;
    // pre-hydration fallback so the picker isn't empty on first paint
    return (tablesProp ?? []).map((t) => ({ ...t, bookings: [] }));
  }, [floor, tablesProp]);

  // the table on screen: the one picked, else the first that books online
  const selectedTable =
    tableList.find((t) => t.id === pickedTableId) ??
    tableList.find((t) => t.bookable !== false) ??
    tableList[0] ??
    null;
  const tableId = selectedTable?.id ?? "";
  const canBookOnline = !!selectedTable && selectedTable.bookable !== false;

  const fetchFloor = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/availability?date=${date}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load availability");
      setFloor(data as FloorAvailability);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load availability");
      setFloor(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!result) fetchFloor();
  }, [fetchFloor, result]);

  // drop a selection that no longer fits (duration / date change)
  useEffect(() => {
    if (!startTime || !floor || !selectedTable) return;
    if (
      !slotOpen(
        selectedTable,
        date,
        startTime,
        duration,
        floor.closeMin,
        floor.graceMin,
      )
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStartTime("");
    }
  }, [duration, date, startTime, floor, selectedTable]);

  const endLabel = startTime
    ? label12h(minutesToTime((timeToMinutes(startTime) + duration * 60) % 1440))
    : "";
  // table's yours until TURNOVER_MIN before the slot ends — the changeover
  // window for the next group, baked into every booking
  const playUntilLabel = startTime
    ? label12h(
        minutesToTime(
          (timeToMinutes(startTime) + duration * 60 - TURNOVER_MIN + 1440) % 1440,
        ),
      )
    : "";
  const total = priceFor(duration);
  const dateShort = new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const stepValid = [
    canBookOnline && !!startTime,
    name.trim().length >= 2 &&
      phone.replace(/\D/g, "").length >= 9 &&
      partySize >= 1,
    agreedTurnover,
  ][step];

  function viewTable(id: string) {
    setPickedTableId(id);
    setStartTime("");
    setError(null);
  }

  function pickStart(start: string) {
    if (!canBookOnline) return; // view-only table
    setStartTime(start);
    setError(null);
  }

  const durIdx = DURATION_OPTIONS.indexOf(duration as (typeof DURATION_OPTIONS)[number]);
  function stepDuration(by: 1 | -1) {
    const next = DURATION_OPTIONS[durIdx + by];
    if (next != null) setDuration(next);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId,
          date,
          startTime,
          durationHrs: duration,
          partySize,
          customerName: name,
          phone,
          email: email || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          await fetchFloor();
          setStartTime("");
          setStep(0);
        }
        throw new Error(data.error || "Could not complete booking");
      }
      setResult({
        reference: data.booking.reference,
        tableName: data.booking.tableName,
        totalAmount: data.booking.totalAmount,
      });
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete booking");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResult(null);
    setStep(0);
    setStartTime("");
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setAgreedTurnover(false);
  }

  const closedDay = !!floor && floor.slotStarts.length === 0;

  // members-only gate
  if (viewer === undefined) {
    return (
      <div className={cn(panel, "grid min-h-[220px] place-items-center p-8")}>
        <p className="text-sm text-mist">Loading…</p>
      </div>
    );
  }
  if (viewer && viewer.role !== "player") {
    return (
      <div className={cn(panel, "p-6 text-center sm:p-10")}>
        <h3 className="font-display text-2xl font-bold text-white">
          Assign tables from the console
        </h3>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-mist">
          Online booking is for members. As staff you seat walk-ins, reserve
          slots and take payment from the operations console.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/admin" className={btnPrimary}>
            Open the console
          </Link>
        </div>
      </div>
    );
  }
  if (viewer === null) {
    return (
      <div className={cn(panel, "p-6 text-center sm:p-10")}>
        <BrandMark size={56} className="mb-4" />
        <h3 className="font-display text-2xl font-bold text-white">
          Sign in to book online
        </h3>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-mist">
          Online table booking is for Cue Point members, and joining is free.
          Your booking history and rank come with the account.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/account?next=/book" className={btnPrimary}>
            Sign in
          </Link>
          <Link href="/account?next=/book" className={btnSecondary}>
            Create free account
          </Link>
        </div>
        <p className="mt-5 text-sm text-mist">
          Rather not sign up? Call{" "}
          <a href={SITE.phoneHref} className="font-semibold text-white underline underline-offset-4">
            {SITE.phone}
          </a>{" "}
          and we will book the table for you.
        </p>
      </div>
    );
  }

  return (
    <div className={panel}>
      {/* progress */}
      {step < 3 && (
        <div className="border-b border-white/10 px-4 py-4 sm:px-7">
          <p className="text-sm text-mist">
            Step {step + 1} of {STEPS.length} ·{" "}
            <span className="font-semibold text-white">{STEPS[step]}</span>
          </p>
          <div className="mt-2.5 flex gap-1.5" aria-hidden>
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  i <= step ? "bg-teal" : "bg-white/15",
                )}
              />
            ))}
          </div>
        </div>
      )}

      <div className="p-4 sm:p-7">
        {/* ---------------------------------------------------- STEP 0 --- */}
        {step === 0 && (
          <div className="space-y-8">
            {/* 1 · day */}
            <Part n={1} title="Which day?">
              <div className="hide-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:-mx-7 sm:px-7">
                {days.map((d, i) => {
                  const dt = new Date(d + "T00:00:00");
                  const active = d === date;
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        setDate(d);
                        setStartTime("");
                      }}
                      aria-pressed={active}
                      className={cn(
                        "flex min-w-[64px] shrink-0 snap-start flex-col items-center rounded-md border px-3 py-2.5 transition-colors",
                        active
                          ? "border-teal bg-teal text-navy-950"
                          : "border-white/15 text-white hover:border-white/40",
                      )}
                    >
                      <span className="text-[11px] font-semibold uppercase">
                        {i === 0
                          ? "Today"
                          : dt.toLocaleDateString("en-GB", { weekday: "short" })}
                      </span>
                      <span className="font-display text-xl font-bold leading-tight">
                        {dt.getDate()}
                      </span>
                      <span className={cn("text-[11px]", active ? "text-navy-950/80" : "text-mist")}>
                        {dt.toLocaleDateString("en-GB", { month: "short" })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Part>

            {/* 2 · length */}
            <Part n={2} title="How long?">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => stepDuration(-1)}
                  disabled={durIdx <= 0}
                  aria-label="Shorter"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/30 text-2xl leading-none text-white transition-colors hover:border-white disabled:opacity-30"
                >
                  &minus;
                </button>
                <div className="flex-1 rounded-md border border-white/15 px-3 py-2 text-center">
                  <span className="block font-display text-xl font-bold text-white">
                    {durationLong(duration)}
                  </span>
                  <span className="block text-sm text-mist">{formatLKR(total)}</span>
                </div>
                <button
                  onClick={() => stepDuration(1)}
                  disabled={durIdx >= DURATION_OPTIONS.length - 1}
                  aria-label="Longer"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/30 text-2xl leading-none text-white transition-colors hover:border-white disabled:opacity-30"
                >
                  +
                </button>
              </div>
              <p className="mt-2 text-xs text-mist">
                {formatLKR(TABLE_HOURLY_RATE)} per full hour, {formatLKR(TABLE_HALF_HOUR_RATE)} for
                a half hour.
              </p>
            </Part>

            {/* 3 · table */}
            <Part n={3} title="Which table?">
              {tableList.length === 0 ? (
                <p className="text-sm text-mist">
                  {loading ? "Loading tables…" : "No tables are on the floor right now. Please call us."}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {tableList.map((t) => {
                    const [num, nick] = splitLabel(t.label);
                    const active = t.id === tableId;
                    return (
                      <button
                        key={t.id}
                        onClick={() => viewTable(t.id)}
                        aria-pressed={active}
                        className={cn(
                          "rounded-md border px-2 py-3 text-center transition-colors",
                          active
                            ? "border-teal bg-teal/15"
                            : "border-white/15 hover:border-white/40",
                        )}
                      >
                        <span className="block font-display text-[15px] font-bold text-white">
                          {num}
                        </span>
                        {nick && (
                          <span className="block truncate text-xs text-mist">{nick}</span>
                        )}
                        <span
                          className={cn(
                            "mt-1.5 block text-[11px] font-semibold uppercase tracking-wide",
                            t.bookable !== false ? "text-teal-bright" : "text-mist",
                          )}
                        >
                          {t.bookable !== false ? "Book online" : "By phone"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedTable && (
                <p className="mt-2 text-xs text-mist">
                  {selectedTable.area}
                  {selectedTable.note ? ` · ${selectedTable.note}` : ""} ·{" "}
                  {selectedTable.seats} seats
                </p>
              )}
            </Part>

            {/* 4 · start time */}
            <Part n={4} title={canBookOnline ? "What time?" : "Availability"}>
              {loading ? (
                <div className="h-40 animate-pulse rounded-md bg-white/5" />
              ) : closedDay ? (
                <p className="text-sm text-mist">
                  We are closed on this day. Pick another date above.
                </p>
              ) : selectedTable && floor ? (
                <TableDay
                  table={selectedTable}
                  floor={floor}
                  date={date}
                  duration={duration}
                  selectedStart={startTime}
                  isToday={isToday}
                  onPick={pickStart}
                />
              ) : null}
            </Part>

            <p className="border-t border-white/10 pt-4 text-xs leading-relaxed text-mist">
              If another group is booked straight after you, the table goes back{" "}
              {TURNOVER_MIN} minutes before your finish time
              {startTime ? (
                <>
                  , so by <span className="font-semibold text-white">{playUntilLabel}</span>
                </>
              ) : null}
              .
            </p>
          </div>
        )}

        {/* ---------------------------------------------------- STEP 1 --- */}
        {step === 1 && (
          <div>
            <h3 className="font-display text-xl font-bold text-white">Your details</h3>
            <p className="mb-5 mt-1 text-sm text-mist">
              So we can hold the table and reach you if plans change.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="input"
                  autoComplete="name"
                />
              </Field>
              <Field label="Phone">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07X XXX XXXX"
                  className="input"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </Field>
              <Field label="Email (optional)">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="input"
                  inputMode="email"
                  autoComplete="email"
                />
              </Field>
              <Field label="How many players?">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                    className="grid h-11 w-11 place-items-center rounded-full border border-white/30 text-xl leading-none text-white hover:border-white"
                    aria-label="Fewer players"
                  >
                    &minus;
                  </button>
                  <span className="w-8 text-center font-display text-xl font-bold text-white">
                    {partySize}
                  </span>
                  <button
                    onClick={() =>
                      setPartySize((n) =>
                        Math.min(selectedTable?.seats ?? 8, n + 1),
                      )
                    }
                    className="grid h-11 w-11 place-items-center rounded-full border border-white/30 text-xl leading-none text-white hover:border-white"
                    aria-label="More players"
                  >
                    +
                  </button>
                  <span className="text-xs text-mist">
                    up to {selectedTable?.seats ?? 8}
                  </span>
                </div>
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Anything we should know? (optional)">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="input resize-none"
                />
              </Field>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- STEP 2 --- */}
        {step === 2 && (
          <div>
            <h3 className="font-display text-xl font-bold text-white">Check your booking</h3>
            <dl className="mt-4 divide-y divide-white/10 border-y border-white/10">
              <Row k="Table" v={selectedTable?.label ?? "—"} />
              <Row
                k="Date"
                v={new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              />
              <Row
                k="Time"
                v={`${label12h(startTime)} – ${endLabel} (${durationLabel(duration)})`}
              />
              <Row
                k="Players"
                v={`${partySize} ${partySize > 1 ? "players" : "player"}`}
              />
              <Row k="Name" v={name} />
              <Row k="Phone" v={phone} />
              {notes && <Row k="Notes" v={notes} />}
              <Row k="Total" v={formatLKR(total)} strong />
            </dl>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-md border border-gold/50 px-3 py-3 text-sm leading-relaxed text-white">
              <input
                type="checkbox"
                checked={agreedTurnover}
                onChange={(e) => setAgreedTurnover(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-[#f4c430]"
              />
              <span>
                I will hand the table back by{" "}
                <span className="font-semibold text-gold">{playUntilLabel}</span>{" "}
                ({TURNOVER_MIN} minutes before my finish time) if another group
                is booked straight after me.
              </span>
            </label>
            {!agreedTurnover && (
              <p className="mt-2 text-xs text-gold">
                Tick the box above to confirm your booking.
              </p>
            )}
            <p className="mt-3 text-xs text-mist">
              Pay at the counter. Free to cancel up to 2 hours before your slot.
            </p>
          </div>
        )}

        {/* ---------------------------------------------------- SUCCESS -- */}
        {step === 3 && result && (
          <div className="py-6 text-center">
            <div className="relative mx-auto h-16 w-16">
              <BrandMark size={64} />
              <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-teal text-navy-950 ring-4 ring-navy-900">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
            <h3 className="mt-5 font-display text-2xl font-bold text-white">
              Table booked
            </h3>
            <p className="mt-2 text-[15px] text-white/85">
              {result.tableName} · {dateShort} · {label12h(startTime)} – {endLabel}
            </p>
            <p className="mt-6 text-sm text-mist">Your reference</p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-gold">
              {result.reference}
            </p>
            <p className="mt-4 text-sm text-mist">Show this at the counter.</p>
            <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-mist">
              If another group is booked straight after you, please hand the
              table back by{" "}
              <span className="font-semibold text-white">{playUntilLabel}</span>.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button onClick={reset} className={btnSecondary}>
                Book another
              </button>
              <Link href="/" className={btnPrimary}>
                Back home
              </Link>
            </div>
          </div>
        )}
      </div>

      {error && step < 3 && (
        <p className="mx-4 mb-3 rounded-md border border-red-400/40 px-3 py-2 text-sm text-red-200 sm:mx-7">
          {error}
        </p>
      )}

      {/* sticky action bar — always in view on mobile */}
      {step < 3 && (
        <div className="sticky bottom-0 z-10 rounded-b-lg border-t border-white/10 bg-navy-950 px-4 py-3 sm:px-7">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {canBookOnline && startTime ? (
                <>
                  <p className="truncate text-sm font-semibold text-white">
                    {dateShort} · {label12h(startTime)}–{endLabel}
                  </p>
                  <p className="truncate text-xs text-mist">
                    {selectedTable?.label} · {formatLKR(total)}
                  </p>
                </>
              ) : (
                <p className="text-xs text-mist">
                  {!canBookOnline && selectedTable
                    ? "This table is booked by phone"
                    : "Choose a start time to continue"}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {step > 0 && (
                <button onClick={() => setStep(step - 1)} className={btnSecondary}>
                  Back
                </button>
              )}
              {step < 2 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!stepValid}
                  className={btnPrimary}
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={submitting || !agreedTurnover}
                  className={btnPrimary}
                >
                  {submitting ? "Booking…" : "Confirm"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- numbered part of step 1 ---------------------------------------------- */

function Part({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-3 font-display text-lg font-bold text-white">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal text-sm font-bold text-navy-950">
          {n}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/* ---- one table's day: timeline diagram + open start times ----------------- */

const BOOKED_HATCH =
  "repeating-linear-gradient(135deg, rgba(255,255,255,0.34) 0 5px, rgba(255,255,255,0.14) 5px 10px)";

const DAY_PARTS = [
  { label: "Afternoon", from: 0, to: 17 * 60 },
  { label: "Evening", from: 17 * 60, to: 22 * 60 },
  { label: "Late night", from: 22 * 60, to: 48 * 60 },
] as const;

function TableDay({
  table,
  floor,
  date,
  duration,
  selectedStart,
  isToday,
  onPick,
}: {
  table: FloorTable;
  floor: FloorAvailability;
  date: string;
  duration: number;
  selectedStart: string;
  isToday: boolean;
  onPick: (start: string) => void;
}) {
  const { openMin, closeMin, graceMin, slotStarts } = floor;
  const span = Math.max(1, closeMin - openMin);
  const pct = (min: number) => ((min - openMin) / span) * 100;

  const ticks: number[] = [];
  for (let m = openMin; m <= closeMin; m += 120) ticks.push(m);

  const bookable = table.bookable !== false;
  const openStarts = slotStarts.filter((s) =>
    slotOpen(table, date, s, duration, closeMin, graceMin),
  );
  const propMin = selectedStart ? sessionMin(selectedStart) : null;
  const propEnd = propMin != null ? propMin + duration * 60 : null;

  return (
    <div>
      {/* the day as a bar: free / booked / your pick */}
      <div
        className="relative h-11 overflow-hidden rounded-md bg-teal/20"
        role="img"
        aria-label={
          table.bookings.length === 0
            ? "Free all day"
            : `Booked ${table.bookings
                .map((b) => `${label12h(b.start)} to ${label12h(b.end)}`)
                .join(", ")}`
        }
      >
        {ticks.slice(1, -1).map((m) => (
          <span
            key={m}
            className="absolute inset-y-0 w-px bg-navy-900/70"
            style={{ left: `${pct(m)}%` }}
          />
        ))}
        {table.bookings.map((b, i) => (
          <span
            key={i}
            className="absolute inset-y-0 bg-navy-900"
            style={{
              left: `${pct(b.startMin)}%`,
              width: `${Math.max(1.5, pct(b.endMin) - pct(b.startMin))}%`,
              backgroundImage: BOOKED_HATCH,
            }}
            title={`Booked ${label12h(b.start)} – ${label12h(b.end)}`}
          />
        ))}
        {propMin != null && propEnd != null && propEnd <= closeMin && (
          <span
            className="absolute inset-y-0 bg-gold"
            style={{
              left: `${pct(propMin)}%`,
              width: `${Math.max(1.5, pct(propEnd) - pct(propMin))}%`,
            }}
            title="Your slot"
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-mist">
        {ticks.map((m, i) => (
          <span key={m} className={cn(i % 2 === 1 && "hidden sm:inline")}>
            {label12h(minutesToTime(m % 1440)).replace(":00", "")}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-mist">
        <span className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm bg-teal/20" /> Free
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm" style={{ backgroundImage: BOOKED_HATCH }} /> Booked
        </span>
        {bookable && (
          <span className="flex items-center gap-2">
            <span className="h-3 w-5 rounded-sm bg-gold" /> Your pick
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-white/85">
        {table.bookings.length === 0
          ? "Nothing booked on this table yet for this day."
          : `Booked: ${table.bookings
              .map((b) => `${label12h(b.start)}–${label12h(b.end)}`)
              .join(", ")}`}
      </p>

      {/* start times */}
      <div className="mt-5">
        {!bookable ? (
          <div className="rounded-md border border-white/15 p-4">
            <p className="text-sm leading-relaxed text-white/85">
              {table.label} is booked by phone or in person, not online.
            </p>
            <a
              href={SITE.phoneHref}
              className={cn(btnPrimary, "mt-3 w-full sm:w-auto")}
            >
              Call {SITE.phone}
            </a>
          </div>
        ) : openStarts.length === 0 ? (
          <p className="rounded-md border border-white/15 p-4 text-sm text-white/85">
            No {durationLong(duration)} slot is free on this table for this day.
            Try a shorter session or another day.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-mist">
              Tap the time you want to start.
              {isToday ? " Earlier times today have passed." : ""}
            </p>
            {DAY_PARTS.map((part) => {
              const starts = openStarts.filter((s) => {
                const m = sessionMin(s);
                return m >= part.from && m < part.to;
              });
              if (starts.length === 0) return null;
              return (
                <div key={part.label}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-white/70">
                    {part.label}
                  </p>
                  <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-6">
                    {starts.map((s) => (
                      <button
                        key={s}
                        onClick={() => onPick(s)}
                        aria-pressed={selectedStart === s}
                        className={cn(
                          "h-11 rounded-md border text-sm font-semibold transition-colors",
                          selectedStart === s
                            ? "border-gold bg-gold text-navy-950"
                            : "border-white/20 text-white hover:border-white/60",
                        )}
                      >
                        {label12h(s).replace(":00", "")}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-mist">{label}</span>
      {children}
    </label>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-sm text-mist">{k}</dt>
      <dd
        className={cn(
          "text-right text-[15px]",
          strong ? "font-display text-xl font-bold text-white" : "text-white",
        )}
      >
        {v}
      </dd>
    </div>
  );
}
