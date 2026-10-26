"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn, formatLKR, label12h, minutesToTime, timeToMinutes } from "@/lib/utils";
import {
  FREE_EVERY_MIN,
  businessDate,
  FREE_REWARD_MIN,
  formatMinutes,
  quoteSession,
  sessionMinutes,
  type PlayTimeSummary,
} from "@/lib/playtime";
import type { DayReservation, PlayLog } from "@/lib/play-logs";

/* ------------------------------------------------------------------
   Daily log — staff enter what was actually played: pick the table,
   type the start and close time, and the minutes and price work
   themselves out. This is the table income; online bookings are only
   reservations and are listed here so they can be logged in one tap.
   ------------------------------------------------------------------ */

type TableLite = { id: string; label: string };
type PlayerLite = { id: string; fullName: string; nickname: string };

// the business day: before 6 AM the log is still on the previous night
const today = () => businessDate();

export function DailyLogTab({
  headers,
  isAdmin,
}: {
  headers: Record<string, string>;
  isAdmin: boolean;
}) {
  const [date, setDate] = useState(today());
  const [logs, setLogs] = useState<PlayLog[] | null>(null);
  const [reservations, setReservations] = useState<DayReservation[]>([]);
  const [tables, setTables] = useState<TableLite[]>([]);
  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  const headerKey = JSON.stringify(headers);
  const load = useCallback(() => {
    fetch(`/api/staff/play-logs?date=${date}`, {
      headers: JSON.parse(headerKey),
      cache: "no-store",
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) return setError(d.error || "Failed to load");
        setLogs(d.logs);
        setReservations(d.reservations);
        setError(null);
      })
      .catch(() => setError("Failed to load"));
  }, [date, headerKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/tables")
      .then((r) => r.json())
      .then((d) => Array.isArray(d.tables) && setTables(d.tables))
      .catch(() => {});
    fetch("/api/staff/players", { headers: JSON.parse(headerKey) })
      .then((r) => r.json())
      .then(
        (d) =>
          Array.isArray(d.players) &&
          setPlayers(
            d.players
              .filter((p: { role?: string }) => !p.role || p.role === "player")
              .map((p: PlayerLite) => ({
                id: p.id,
                fullName: p.fullName,
                nickname: p.nickname,
              })),
          ),
      )
      .catch(() => {});
  }, [headerKey]);

  async function remove(id: string) {
    if (!confirm("Delete this entry? Its income and playing hours are removed.")) return;
    setBusy(true);
    const res = await fetch(`/api/staff/play-logs?id=${id}`, {
      method: "DELETE",
      headers: JSON.parse(headerKey),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(d.error || "Delete failed");
    load();
  }

  const list = useMemo(() => logs ?? [], [logs]);
  const income = list.reduce((s, l) => s + l.amount, 0);
  const playedMin = list.reduce((s, l) => s + l.playedMin, 0);
  const freeMin = list.reduce((s, l) => s + l.freeMin, 0);
  const byTable = useMemo(() => {
    const m = new Map<string, { min: number; amount: number; n: number }>();
    for (const l of list) {
      const t = m.get(l.tableName) ?? { min: 0, amount: 0, n: 0 };
      t.min += l.playedMin;
      t.amount += l.amount;
      t.n += 1;
      m.set(l.tableName, t);
    }
    return [...m.entries()];
  }, [list]);

  return (
    <div className="space-y-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-white">Daily log</h3>
          <p className="mt-0.5 max-w-xl text-xs text-mist">
            Enter every session played: table, start and close time. Minutes and price are
            worked out for you. This is the table income — online bookings are only
            reservations and don&apos;t count until they&apos;re logged here.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-[11px] text-mist">Day</span>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="input w-44"
          />
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <LogForm
        key={prefill?.key ?? "blank"}
        date={date}
        tables={tables}
        players={players}
        headers={headers}
        prefill={prefill}
        onSaved={() => {
          setPrefill(null);
          load();
        }}
      />

      {reservations.length > 0 && (
        <section>
          <h3 className="font-display text-base font-semibold text-white">
            Online reservations this day
          </h3>
          <p className="mt-0.5 mb-3 text-xs text-mist">
            Not income. Once they&apos;ve played, tap “Log it” and fix the times if they ran over.
          </p>
          <ul className="divide-y divide-white/8 rounded-2xl border border-white/10">
            {reservations.map((r) => {
              const end = minutesToTime(timeToMinutes(r.startTime) + r.durationHrs * 60);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="font-mono text-[11px] text-teal">{r.reference}</span>
                  <span className="text-white">{r.tableName}</span>
                  <span className="text-mist">
                    {label12h(r.startTime)} – {label12h(end)}
                  </span>
                  <span className="text-white/90">{r.customerName}</span>
                  <span className="ml-auto">
                    {r.logged ? (
                      <span className="rounded-full bg-teal/15 px-2.5 py-1 text-[11px] text-teal">
                        logged
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          setPrefill({
                            key: r.id + Date.now(),
                            tableId: r.tableId,
                            startTime: r.startTime,
                            endTime: end,
                            playerId: r.playerId ?? "",
                            customerName: r.customerName,
                            bookingId: r.id,
                          })
                        }
                        className="btn-ghost px-3 py-1.5 text-xs"
                      >
                        Log it
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat k="Sessions" v={String(list.length)} />
          <Stat k="Time played" v={formatMinutes(playedMin)} />
          <Stat k="Free time given" v={formatMinutes(freeMin)} />
          <Stat k="Income" v={formatLKR(income)} />
        </div>
        {byTable.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {byTable.map(([name, t]) => (
              <span
                key={name}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-mist"
              >
                <span className="text-white">{name}</span> · {t.n} ·{" "}
                {formatMinutes(t.min)} · {formatLKR(t.amount)}
              </span>
            ))}
          </div>
        )}

        {logs && list.length === 0 ? (
          <p className="text-sm text-mist">Nothing logged for this day yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-mist">
                <tr>
                  {["Table", "Time", "Player", "Played", "Free", "Amount", "By", ""].map((h) => (
                    <th key={h} className="px-3 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {list.map((l) => (
                  <tr key={l.id} className="text-white/90">
                    <td className="px-3 py-2.5">{l.tableName}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {label12h(l.startTime)} – {label12h(l.endTime)}
                    </td>
                    <td className="px-3 py-2.5">
                      {l.customerName}
                      {l.playerId && (
                        <span className="ml-1.5 rounded-full bg-teal/15 px-1.5 py-0.5 text-[10px] text-teal">
                          member
                        </span>
                      )}
                      {l.bookingId && (
                        <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-mist">
                          booked
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">{formatMinutes(l.playedMin)}</td>
                    <td className="px-3 py-2.5">{l.freeMin ? formatMinutes(l.freeMin) : "—"}</td>
                    <td className="px-3 py-2.5">
                      {formatLKR(l.amount)}
                      {l.discount > 0 && (
                        <span className="ml-1 text-[11px] text-mist">
                          (−{formatLKR(l.discount)})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-mist">{l.createdBy}</td>
                    <td className="px-3 py-2.5 text-right">
                      {isAdmin && (
                        <button
                          disabled={busy}
                          onClick={() => remove(l.id)}
                          className="text-[11px] text-rose-300 hover:text-rose-200 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

type Prefill = {
  key: string;
  tableId: string;
  startTime: string;
  endTime: string;
  playerId: string;
  customerName: string;
  bookingId: string;
};

function LogForm({
  date,
  tables,
  players,
  headers,
  prefill,
  onSaved,
}: {
  date: string;
  tables: TableLite[];
  players: PlayerLite[];
  headers: Record<string, string>;
  prefill: Prefill | null;
  onSaved: () => void;
}) {
  const [tableId, setTableId] = useState(prefill?.tableId ?? "");
  const [start, setStart] = useState(prefill?.startTime ?? "");
  const [end, setEnd] = useState(prefill?.endTime ?? "");
  const [playerId, setPlayerId] = useState(prefill?.playerId ?? "");
  const [search, setSearch] = useState("");
  const [name, setName] = useState(prefill?.playerId ? "" : (prefill?.customerName ?? ""));
  const [discount, setDiscount] = useState("");
  const [freeMin, setFreeMin] = useState<number | null>(null); // null = use all available
  const [playTime, setPlayTime] = useState<PlayTimeSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const headerKey = JSON.stringify(headers);
  useEffect(() => {
    if (!playerId) return;
    let live = true;
    fetch(`/api/staff/play-logs?player=${encodeURIComponent(playerId)}`, {
      headers: JSON.parse(headerKey),
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => live && setPlayTime(d.playTime ?? null))
      .catch(() => live && setPlayTime(null));
    return () => {
      live = false;
    };
  }, [playerId, headerKey]);

  const player = players.find((p) => p.id === playerId) ?? null;
  const pt = playerId ? playTime : null;
  const minutes = start && end ? sessionMinutes(start, end) : null;
  const balance = pt?.freeBalance ?? 0;
  const maxFree = minutes ? Math.min(balance, Math.ceil(minutes / 30) * 30) : 0;
  const useFree = Math.min(freeMin ?? maxFree, maxFree);
  const quote = minutes ? quoteSession(minutes, { freeMin: useFree, discount: Number(discount) || 0 }) : null;

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return players
      .filter(
        (p) => p.fullName.toLowerCase().includes(q) || p.nickname.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [players, search]);

  const canSave = !!tableId && !!quote && (!!playerId || name.trim().length >= 2) && !busy;

  async function save() {
    if (!quote) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/staff/play-logs", {
      method: "POST",
      headers: { ...JSON.parse(headerKey), "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        tableId,
        startTime: start,
        endTime: end,
        playerId: playerId || undefined,
        customerName: name.trim() || undefined,
        bookingId: prefill?.bookingId || undefined,
        freeMin: quote.freeMin,
        discount: quote.discount,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || "Could not save" });
    setMsg({
      ok: true,
      text: `Saved · ${d.log.tableName} · ${formatMinutes(d.log.playedMin)} · ${formatLKR(d.log.amount)}`,
    });
    setStart("");
    setEnd("");
    setPlayerId("");
    setName("");
    setDiscount("");
    setFreeMin(null);
    setPlayTime(null);
    onSaved();
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <h3 className="text-xs uppercase tracking-[0.24em] text-teal">
        {prefill ? "Log reservation" : "New entry"}
      </h3>

      {/* table */}
      <p className="mb-2 mt-5 text-xs text-mist">Table</p>
      <div className="flex flex-wrap gap-2">
        {tables.map((t) => (
          <button
            key={t.id}
            onClick={() => setTableId(t.id)}
            className={cn(
              "min-w-[7rem] rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
              tableId === t.id
                ? "border-teal bg-teal/15 text-white"
                : "border-white/10 text-mist hover:border-white/30 hover:text-white",
            )}
          >
            {t.label}
          </button>
        ))}
        {tables.length === 0 && <p className="text-xs text-mist">Loading tables…</p>}
      </div>

      {/* times */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-mist">Start time</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-mist">Close time</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="input" />
        </label>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
          <p className="text-[11px] text-mist">Time played</p>
          <p className="font-display text-lg font-semibold text-white">
            {minutes ? formatMinutes(minutes) : start && end ? "Check times" : "—"}
          </p>
        </div>
      </div>

      {/* player */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <span className="mb-1 block text-xs text-mist">Registered player (optional)</span>
          {player ? (
            <div className="flex items-center justify-between rounded-xl border border-teal/40 bg-teal/10 px-3 py-2.5 text-sm">
              <span className="text-white">
                {player.fullName} <span className="text-mist">({player.nickname})</span>
              </span>
              <button
                onClick={() => {
                  setPlayerId("");
                  setFreeMin(null);
                  setPlayTime(null);
                }}
                className="text-xs text-mist hover:text-white"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or nickname"
                className="input"
              />
              {matches.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-white/15 bg-[#0d1416] shadow-xl">
                  {matches.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => {
                          setPlayerId(p.id);
                          setSearch("");
                          setName("");
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                      >
                        {p.fullName} <span className="text-mist">({p.nickname})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        {!player && (
          <label className="block">
            <span className="mb-1 block text-xs text-mist">Or customer name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Walk-in name"
              className="input"
            />
          </label>
        )}
        {player && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs text-mist">
            {pt ? (
              <>
                <p>
                  <span className="text-white">{formatMinutes(pt.paidMin)}</span> played ·{" "}
                  <span className="text-teal">{formatMinutes(pt.freeBalance)} free</span> available
                </p>
                <p className="mt-0.5">
                  {formatMinutes(pt.toNextFreeMin)} more to the next free{" "}
                  {FREE_REWARD_MIN} min
                </p>
              </>
            ) : (
              "Loading hours…"
            )}
          </div>
        )}
      </div>

      {/* free time + discount */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {player && maxFree > 0 && (
          <label className="block">
            <span className="mb-1 block text-xs text-mist">Use free time</span>
            <select
              value={useFree}
              onChange={(e) => setFreeMin(Number(e.target.value))}
              className="input"
            >
              {Array.from({ length: maxFree / 30 + 1 }, (_, i) => i * 30).map((m) => (
                <option key={m} value={m}>
                  {m ? formatMinutes(m) : "Don't use now"}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-xs text-mist">Discount LKR (optional, e.g. membership)</span>
          <input
            type="number"
            min={0}
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="0"
            className="input"
          />
        </label>
      </div>

      {/* bill */}
      {quote && (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-mist">
            <span>
              Played <span className="text-white">{formatMinutes(quote.playedMin)}</span>
            </span>
            <span>
              Billed <span className="text-white">{formatMinutes(quote.billedMin)}</span>
            </span>
            {quote.freeMin > 0 && (
              <span className="text-teal">− {formatMinutes(quote.freeMin)} free</span>
            )}
            {quote.discount > 0 && <span>− {formatLKR(quote.discount)} discount</span>}
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold text-white">
            {formatLKR(quote.amount)}
          </p>
        </div>
      )}

      {msg && (
        <p
          className={cn(
            "mt-4 rounded-lg border px-3 py-2 text-xs",
            msg.ok
              ? "border-teal/30 bg-teal/10 text-teal"
              : "border-rose-400/30 bg-rose-400/10 text-rose-200",
          )}
        >
          {msg.text}
        </p>
      )}

      <button
        disabled={!canSave}
        onClick={save}
        className="btn-primary mt-4 px-5 py-2.5 text-sm disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save entry"}
      </button>
      <p className="mt-3 text-[11px] text-mist/70">
        Time is billed in 30-minute blocks. Every {FREE_EVERY_MIN / 60} paid hours a member earns{" "}
        {FREE_REWARD_MIN} free minutes.
      </p>
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
      <div className="font-display text-xl font-bold text-white">{v}</div>
      <div className="mt-0.5 text-[11px] text-mist">{k}</div>
    </div>
  );
}
