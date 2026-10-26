"use client";

import { useMemo, useState } from "react";
import { ENTRY_KINDS, KIND_LABELS, entryEffect } from "@/lib/accounts-categories";
import { Card, KindBadge, Money, addDays, entryTitle, shortDate, useAccounts, useSend, useView, type Entry } from "./ui";
import { EditPanel } from "./EntryEdit";

export function Ledger() {
  const { meta } = useAccounts();
  const [from, setFrom] = useState(addDays(meta.today, -30));
  const [to, setTo] = useState(meta.today);
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const params: Record<string, string> = { view: "ledger", from, to };
  if (kind) params.kind = kind;
  const { data, err } = useView<{ entries: Entry[] }>(params);
  const canEdit = meta.access.canEdit;
  const [editing, setEditing] = useState<string | null>(null);
  const { send, busy } = useSend();
  const cols = canEdit ? 6 : 5;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = data?.entries ?? [];
    return needle
      ? list.filter((e) =>
          [entryTitle(e), e.category, e.description, e.tableName ?? "", e.partnerName ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(needle),
        )
      : list;
  }, [data, q]);

  const sum = rows.reduce(
    (s, e) => {
      const f = entryEffect(e);
      return { cash: s.cash + f.cash, bank: s.bank + f.bank };
    },
    { cash: 0, bank: 0 },
  );

  const exportCsv = () => {
    const head = ["Date", "Type", "Category", "Detail", "Description", "Table", "In", "Out", "Cash", "Bank"];
    const lines = rows.map((e) => {
      const f = entryEffect(e);
      return [e.date, KIND_LABELS[e.kind], e.category, entryTitle(e), e.description, e.tableName ?? "", e.startTime ?? "", e.endTime ?? "", f.cash, f.bank];
    });
    const csv = [head, ...lines]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `cue-point-ledger-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card
      title="Ledger"
      sub="Every entry in the books. Cash and bank columns show the effect on each account."
      action={
        <button onClick={exportCsv} disabled={!rows.length} className="btn-ghost px-3 py-1.5 text-[11px] disabled:opacity-40">
          Export CSV
        </button>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="input h-9 text-xs" />
        <input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="input h-9 text-xs" />
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="input h-9 text-xs">
          <option value="">All types</option>
          {ENTRY_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="input h-9 text-xs" />
      </div>
      {!data ? (
        <p className="text-sm text-mist">{err ?? "Loading…"}</p>
      ) : (
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wide text-mist">
              <tr className="border-b border-white/10">
                <th className="px-5 py-2 font-medium sm:px-6">Date</th>
                <th className="px-3 py-2 font-medium">Entry</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Cash</th>
                <th className="px-5 py-2 text-right font-medium sm:px-6">Bank</th>
                {canEdit && <th className="w-28 px-5 py-2 sm:px-6" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map((e) => {
                const f = entryEffect(e);
                if (editing === e.id)
                  return <EditPanel key={e.id} e={e} colSpan={cols} onDone={() => setEditing(null)} />;
                return (
                  <tr key={e.id} className="text-white/90">
                    <td className="whitespace-nowrap px-5 py-2 text-xs text-mist sm:px-6">{shortDate(e.date)}</td>
                    <td className="px-3 py-2">
                      <p>{entryTitle(e)}</p>
                      <p className="text-[11px] text-mist">
                        {e.category}
                        {e.description && e.description !== entryTitle(e) ? ` · ${e.description}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <KindBadge kind={e.kind} />
                    </td>
                    <td className="px-3 py-2 text-right">{f.cash ? <Money v={f.cash} tag={false} signed /> : <span className="text-mist/40">—</span>}</td>
                    <td className="px-5 py-2 text-right sm:px-6">{f.bank ? <Money v={f.bank} tag={false} signed /> : <span className="text-mist/40">—</span>}</td>
                    {canEdit && (
                      <td className="whitespace-nowrap px-5 py-2 text-right text-[11px] sm:px-6">
                        <button onClick={() => setEditing(e.id)} className="text-mist hover:text-white">
                          Edit
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => confirm(`Delete "${entryTitle(e)}"?`) && send("DELETE", { id: e.id })}
                          className="ml-3 text-rose-300/80 hover:text-rose-200"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={cols} className="px-6 py-8 text-center text-sm text-mist">
                    No entries match.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-white/15 text-xs">
                  <td colSpan={3} className="px-5 py-2.5 font-medium text-white sm:px-6">
                    Net movement · {rows.length} entries
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Money v={sum.cash} tag={false} signed className="font-semibold" />
                  </td>
                  <td className="px-5 py-2.5 text-right sm:px-6">
                    <Money v={sum.bank} tag={false} signed className="font-semibold" />
                  </td>
                  {canEdit && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </Card>
  );
}
