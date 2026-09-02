"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
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

/** "0.5" → "30 min", "1" → "1h", "1.5" → "1h 30m" */
function durationLabel(h: number): string {
  const whole = Math.floor(h);
  const half = h - whole >= 0.5;
  if (whole === 0) return "30 min";
  return half ? `${whole}h 30m` : `${whole}h`;
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
  const [dir, setDir] = useState(1);

  const [date, setDate] = useState<string>(() => firstOpenDay());
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [tableId, setTableId] = useState<string>(initialTable ?? "");
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

  const selectedTable = tableList.find((t) => t.id === tableId) ?? null;
  const lockedTables = tableList.filter((t) => t.bookable === false);
  const openTables = tableList.filter((t) => t.bookable !== false);

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

  const stepValid = [
    !!tableId && !!startTime,
    name.trim().length >= 2 &&
      phone.replace(/\D/g, "").length >= 9 &&
      partySize >= 1,
    agreedTurnover,
  ][step];

  function goTo(next: number) {
    setDir(next > step ? 1 : -1);
    setStep(next);
  }

  function pick(tid: string, start: string) {
    const t = tableList.find((x) => x.id === tid);
    if (t && t.bookable === false) return; // view-only table
    setTableId(tid);
    setStartTime(start);
    setError(null);
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
          goTo(0);
        }
        throw new Error(data.error || "Could not complete booking");
      }
      setResult({
        reference: data.booking.reference,
        tableName: data.booking.tableName,
        totalAmount: data.booking.totalAmount,
      });
      setDir(1);
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
      <div className="grid min-h-[220px] place-items-center rounded-2xl border border-white/[0.06] glass-strong p-8 sm:rounded-[28px]">
        <p className="text-sm text-mist">Loading…</p>
      </div>
    );
  }
  if (viewer && viewer.role !== "player") {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] glass-strong p-6 text-center sm:rounded-[28px] sm:p-10">
        <span className="text-xs uppercase tracking-[0.3em] text-teal">
          Staff
        </span>
        <h3 className="mt-3 font-display text-2xl font-bold text-white">
          Assign tables from the console
        </h3>
        <p className="mx-auto mt-3 max-w-sm text-sm text-mist">
          Online booking is for members. As staff you seat walk-ins, reserve
          slots and take payment from the operations console.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/admin" className="btn-primary px-6 py-3 text-sm">
            Open the console
          </Link>
        </div>
      </div>
    );
  }
  if (viewer === null) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] glass-strong p-6 text-center sm:rounded-[28px] sm:p-10">
        <span className="text-xs uppercase tracking-[0.3em] text-teal">
          Members only
        </span>
        <h3 className="mt-3 font-display text-2xl font-bold text-white">
          Sign in to book online
        </h3>
        <p className="mx-auto mt-3 max-w-sm text-sm text-mist">
          Online table booking is for Cue Point members — it&apos;s free to join.
          Sign in or create an account and your booking history, loyalty points
          and rank all come with it.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/account?next=/book"
            className="btn-primary px-6 py-3 text-sm"
          >
            Sign in
          </Link>
          <Link href="/account?next=/book" className="btn-ghost px-6 py-3 text-sm">
            Create free account
          </Link>
        </div>
        <p className="mt-5 text-[11px] text-mist">
          Not a member? Call {" "}
          <span className="text-white">the counter</span> and we&apos;ll book the
          table for you.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] glass-strong sm:rounded-[28px]">
      {/* progress */}
      {step < 3 && (
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-4 sm:gap-2 sm:px-6">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => i < step && goTo(i)}
                disabled={i > step}
                className={cn(
                  "flex items-center gap-2 text-xs font-medium transition-colors",
                  i === step
                    ? "text-white"
                    : i < step
                      ? "text-teal"
                      : "text-mist/60",
                  i < step && "cursor-pointer hover:text-teal-bright",
                )}
              >
                <span
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-full border text-[11px]",
                    i === step
                      ? "border-teal bg-teal/20 text-white"
                      : i < step
                        ? "border-teal bg-teal text-navy-950"
                        : "border-white/[0.14]",
                  )}
                >
                  {i < step ? "✓" : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <span
                  className={cn(
                    "h-px flex-1 transition-colors",
                    i < step ? "bg-teal" : "bg-white/[0.08]",
                  )}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -32 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="p-4 sm:p-6 md:p-7"
          >
            {/* ---------------------------------------------------- STEP 0 --- */}
            {step === 0 && (
              <div>
                <h3 className="font-display text-xl font-semibold text-white">
                  Pick a day &amp; time
                </h3>
                <p className="mb-3 mt-1 text-xs text-mist">
                  Grey blocks are already booked. Tap any open time under a table
                  to grab it — back-to-back slots are fine.
                </p>
                <p className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
                  <span className="font-semibold text-amber-300">
                    Please note ·{" "}
                  </span>
                  if another group is booked right after you, you must return the
                  table {TURNOVER_MIN} minutes before your booking&apos;s finish
                  time
                  {startTime ? (
                    <>
                      {" "}
                      — that&apos;s by{" "}
                      <span className="font-semibold text-amber-100">
                        {playUntilLabel}
                      </span>
                    </>
                  ) : (
                    ""
                  )}
                  .
                </p>

                {/* day strip */}
                <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                  {days.map((d) => {
                    const dt = new Date(d + "T00:00:00");
                    const active = d === date;
                    return (
                      <button
                        key={d}
                        onClick={() => {
                          setDate(d);
                          setStartTime("");
                        }}
                        className={cn(
                          "flex min-w-[58px] shrink-0 flex-col items-center rounded-xl border px-3 py-2 transition-colors",
                          active
                            ? "border-teal bg-teal/15 text-white"
                            : "border-white/[0.08] text-mist hover:border-white/25",
                        )}
                      >
                        <span className="text-[10px] uppercase tracking-wide">
                          {dt.toLocaleDateString("en-GB", { weekday: "short" })}
                        </span>
                        <span className="font-display text-lg font-semibold leading-tight">
                          {dt.getDate()}
                        </span>
                        <span className="text-[10px] text-mist">
                          {dt.toLocaleDateString("en-GB", { month: "short" })}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {isToday && (
                  <p className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-mist">
                    We&apos;re open 12 noon–2 AM. Times earlier than now have
                    passed for today — pick another day to see the full range.
                  </p>
                )}

                {/* duration */}
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-mist">How long?</span>
                    <span className="text-[11px] text-mist">
                      30 min · {formatLKR(TABLE_HALF_HOUR_RATE)} — then{" "}
                      {formatLKR(TABLE_HOURLY_RATE)} / full hour
                    </span>
                  </div>
                  <div className="hide-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
                    {DURATION_OPTIONS.map((h) => (
                      <button
                        key={h}
                        onClick={() => setDuration(h)}
                        className={cn(
                          "h-9 shrink-0 rounded-lg border px-2.5 text-xs transition-colors",
                          duration === h
                            ? "border-teal bg-teal/15 text-white"
                            : "border-white/[0.08] text-mist hover:border-white/25",
                        )}
                      >
                        {durationLabel(h)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* legend */}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-mist">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-4 rounded-sm bg-teal/25" /> open
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-4 rounded-sm bg-white/[0.18]" /> booked
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-4 rounded-sm bg-teal" /> your pick
                  </span>
                </div>

                {lockedTables.length > 0 && (
                  <p className="mb-4 rounded-lg border border-teal/30 bg-teal/10 px-3 py-2.5 text-[11px] leading-relaxed text-teal-bright">
                    <span className="font-semibold">Online booking</span> is open
                    for{" "}
                    <span className="font-semibold text-white">
                      {openTables.map((t) => t.label).join(", ") || "—"}
                    </span>
                    .{" "}
                    {lockedTables.map((t) => t.label).join(" & ")}{" "}
                    {lockedTables.length > 1 ? "are" : "is"} shown below for live
                    availability only — call{" "}
                    <a
                      href={SITE.phoneHref}
                      className="font-semibold text-white underline"
                    >
                      {SITE.phone}
                    </a>{" "}
                    to reserve {lockedTables.length > 1 ? "them" : "it"}.
                  </p>
                )}

                {/* tables */}
                <div className="mt-4 space-y-3">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-40 animate-pulse rounded-2xl bg-white/5"
                      />
                    ))
                  ) : closedDay ? (
                    <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-mist">
                      We&apos;re closed on this day. Pick another date above.
                    </p>
                  ) : tableList.length === 0 ? (
                    <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-mist">
                      No tables are on the floor right now. Please call us.
                    </p>
                  ) : (
                    tableList.map((t) => (
                      <TableCard
                        key={t.id}
                        table={t}
                        floor={floor}
                        date={date}
                        duration={duration}
                        selectedStart={tableId === t.id ? startTime : ""}
                        highlight={tableId === t.id}
                        onPick={(s) => pick(t.id, s)}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- STEP 1 --- */}
            {step === 1 && (
              <div>
                <h3 className="font-display text-xl font-semibold text-white">
                  Your details
                </h3>
                <p className="mb-5 mt-1 text-xs text-mist">
                  So we can hold the table and reach you if plans change.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Full name">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ishara Perera"
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
                  <Field label="Party size">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                        className="h-11 w-11 rounded-lg border border-white/[0.08] text-lg text-white hover:border-teal/50"
                        aria-label="Fewer players"
                      >
                        –
                      </button>
                      <span className="w-8 text-center font-display text-lg text-white">
                        {partySize}
                      </span>
                      <button
                        onClick={() =>
                          setPartySize((n) =>
                            Math.min(selectedTable?.seats ?? 8, n + 1),
                          )
                        }
                        className="h-11 w-11 rounded-lg border border-white/[0.08] text-lg text-white hover:border-teal/50"
                        aria-label="More players"
                      >
                        +
                      </button>
                      <span className="text-[11px] text-mist">
                        {selectedTable?.seats ?? 8} seats
                      </span>
                    </div>
                  </Field>
                </div>
                <Field label="Anything we should know? (optional)">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Birthday, coaching, cake at the booth…"
                    className="input resize-none"
                  />
                </Field>
              </div>
            )}

            {/* ---------------------------------------------------- STEP 2 --- */}
            {step === 2 && (
              <div>
                <h3 className="font-display text-xl font-semibold text-white">
                  Look right?
                </h3>
                <p className="mb-5 mt-1 text-xs text-mist">
                  Confirm and the table&apos;s yours.
                </p>
                <dl className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.06] bg-white/[0.02]">
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
                    k="Party"
                    v={`${partySize} ${partySize > 1 ? "players" : "player"}`}
                  />
                  <Row k="Name" v={name} />
                  <Row k="Phone" v={phone} />
                  {notes && <Row k="Notes" v={notes} />}
                  <Row k="Total" v={formatLKR(total)} strong />
                </dl>
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-3 text-[12px] text-amber-100">
                  <input
                    type="checkbox"
                    checked={agreedTurnover}
                    onChange={(e) => setAgreedTurnover(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-amber-400"
                  />
                  <span>
                    I agree to return the table by{" "}
                    <span className="font-semibold text-amber-50">
                      {playUntilLabel}
                    </span>{" "}
                    — {TURNOVER_MIN} minutes before my booking&apos;s finish time —
                    if another group is booked right after me.
                  </span>
                </label>
                {!agreedTurnover && (
                  <p className="mt-1.5 text-[11px] text-amber-300/80">
                    Tick the box above to confirm your booking.
                  </p>
                )}
                <p className="mt-2 text-[11px] text-mist">
                  Pay at the counter. Free to cancel up to 2 hours before your
                  slot.
                </p>
              </div>
            )}

            {/* ---------------------------------------------------- SUCCESS -- */}
            {step === 3 && result && (
              <div className="py-6 text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14 }}
                  className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-teal text-navy-950"
                >
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.div>
                <h3 className="mt-5 font-display text-2xl font-bold text-white">
                  Table booked
                </h3>
                <p className="mt-2 text-sm text-mist">
                  {result.tableName} ·{" "}
                  {new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  · {label12h(startTime)} – {endLabel}
                </p>
                <div className="mx-auto mt-5 inline-flex items-center gap-3 rounded-xl border border-teal/40 bg-teal/10 px-5 py-3">
                  <span className="text-xs text-mist">Reference</span>
                  <span className="font-mono text-lg tracking-widest text-white">
                    {result.reference}
                  </span>
                </div>
                <p className="mt-4 text-xs text-mist">
                  Show this at the counter. We&apos;ll have the rack ready.
                </p>
                <p className="mx-auto mt-3 max-w-sm rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
                  If another group is booked right after you, please hand the
                  table back by{" "}
                  <span className="font-semibold text-amber-100">
                    {playUntilLabel}
                  </span>{" "}
                  — {TURNOVER_MIN} min before your slot ends.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button onClick={reset} className="btn-ghost px-6 py-3 text-sm">
                    Book another
                  </button>
                  <Link href="/" className="btn-primary px-6 py-3 text-sm">
                    Back home
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {error && step < 3 && (
        <p className="mx-4 mb-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200 sm:mx-6">
          {error}
        </p>
      )}

      {/* sticky action bar — always in view on mobile */}
      {step < 3 && (
        <div className="sticky bottom-0 z-10 border-t border-white/[0.06] bg-navy-950/85 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {tableId && startTime ? (
                <p className="truncate text-xs text-white">
                  <span className="text-mist">
                    {selectedTable?.label} ·{" "}
                  </span>
                  {label12h(startTime)}–{endLabel}
                  <span className="text-mist"> · {formatLKR(total)}</span>
                </p>
              ) : (
                <p className="truncate text-xs text-mist">
                  {step === 0 ? "Pick a table and time to continue" : "—"}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {step > 0 && (
                <button
                  onClick={() => goTo(step - 1)}
                  className="btn-ghost px-4 py-2.5 text-sm"
                >
                  Back
                </button>
              )}
              {step < 2 ? (
                <button
                  onClick={() => goTo(step + 1)}
                  disabled={!stepValid}
                  className="btn-primary px-6 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={submitting || !agreedTurnover}
                  className="btn-primary px-6 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? "Booking…" : `Confirm · ${formatLKR(total)}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- one table's day: timeline + open start times ------------------------- */

function TableCard({
  table,
  floor,
  date,
  duration,
  selectedStart,
  highlight,
  onPick,
}: {
  table: FloorTable;
  floor: FloorAvailability | null;
  date: string;
  duration: number;
  selectedStart: string;
  highlight: boolean;
  onPick: (start: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlight && selectedStart) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [highlight, selectedStart]);

  if (!floor) return null;

  const { openMin, closeMin, graceMin, slotStarts } = floor;
  const span = Math.max(1, closeMin - openMin);
  const pct = (min: number) => ((min - openMin) / span) * 100;

  const ticks: number[] = [];
  for (let m = openMin; m <= closeMin; m += 120) ticks.push(m);

  const openStarts = slotStarts.filter((s) =>
    slotOpen(table, date, s, duration, closeMin, graceMin),
  );
  const propMin = selectedStart ? sessionMin(selectedStart) : null;
  const propEnd = propMin != null ? propMin + duration * 60 : null;

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border p-3.5 transition-colors sm:p-4",
        highlight
          ? "border-teal bg-teal/[0.06]"
          : "border-white/[0.08] bg-white/[0.02]",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span className="font-display text-base font-semibold text-white">
            {table.label}
          </span>
          <span className="ml-2 text-[11px] text-mist">
            {table.area}
            {table.note ? ` · ${table.note}` : ""} · {table.seats} seats
          </span>
        </div>
        <span className="shrink-0 text-[11px] text-mist">
          {!table.bookable && (
            <span className="mr-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-mist">
              phone / in person
            </span>
          )}
          {table.bookings.length === 0
            ? "Wide open"
            : `${table.bookings.length} booked`}
        </span>
      </div>

      {/* timeline */}
      <div className="mt-2.5 h-7 overflow-hidden rounded-lg bg-teal/[0.10]">
        <div className="relative h-full w-full">
          {table.bookings.map((b, i) => (
            <span
              key={i}
              className="absolute inset-y-0 bg-white/[0.18]"
              style={{
                left: `${pct(b.startMin)}%`,
                width: `${Math.max(1.5, pct(b.endMin) - pct(b.startMin))}%`,
              }}
              title={`Booked ${label12h(b.start)} – ${label12h(b.end)}`}
            />
          ))}
          {propMin != null && propEnd != null && propEnd <= closeMin && (
            <span
              className="absolute inset-y-0 rounded-sm border-x border-teal bg-teal/60"
              style={{
                left: `${pct(propMin)}%`,
                width: `${Math.max(1.5, pct(propEnd) - pct(propMin))}%`,
              }}
              title="Your slot"
            />
          )}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-mist/70">
        {ticks.map((m) => (
          <span key={m}>
            {label12h(minutesToTime(m % 1440)).replace(":00", "")}
          </span>
        ))}
      </div>

      {table.bookings.length > 0 && (
        <p className="mt-1.5 text-[11px] text-mist">
          Booked:{" "}
          {table.bookings
            .map((b) => `${label12h(b.start)}–${label12h(b.end)}`)
            .join(" · ")}
        </p>
      )}

      {/* open start times */}
      <div className="mt-3">
        {!table.bookable ? (
          <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-mist">
            {table.bookings.length === 0
              ? "Free right now."
              : "See booked times above."}{" "}
            This table isn&apos;t on online booking — call{" "}
            <a href={SITE.phoneHref} className="text-teal underline">
              {SITE.phone}
            </a>{" "}
            to reserve it.
          </p>
        ) : openStarts.length === 0 ? (
          <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-mist">
            No {durationLabel(duration)} slot free here on this day.
          </p>
        ) : (
          <>
            <p className="mb-1.5 text-[11px] text-mist">
              Open {durationLabel(duration)} starts — tap to book:
            </p>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {openStarts.map((s) => (
                <button
                  key={s}
                  onClick={() => onPick(s)}
                  className={cn(
                    "h-10 rounded-lg border text-xs font-medium transition-colors",
                    selectedStart === s
                      ? "border-teal bg-teal text-navy-950"
                      : "border-white/[0.10] text-white hover:border-teal/60 hover:bg-teal/10",
                  )}
                >
                  {label12h(s).replace(":00", "")}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-mist">{label}</span>
      {children}
    </label>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-xs text-mist">{k}</dt>
      <dd
        className={cn(
          "text-right text-sm",
          strong ? "font-display text-lg font-bold text-white" : "text-white/90",
        )}
      >
        {v}
      </dd>
    </div>
  );
}
