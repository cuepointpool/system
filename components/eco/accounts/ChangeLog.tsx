"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { KIND_LABELS, type EntryKind } from "@/lib/accounts-categories";
import { Card, Seg, fmt, shortDate, useView } from "./ui";

type Snapshot = {
  date: string;
  kind: EntryKind;
  category: string;
  description: string;
  tableName: string | null;
  startTime: string | null;
  endTime: string | null;
  partnerName: string | null;
  cash: number;
  bank: number;
};
type LogLine = {
  id: number;
  entryId: string;
  action: "create" | "edit" | "delete";
  actor: string;
  at: string;
  before: Snapshot | null;
  after: Snapshot | null;
};

const FIELDS: { key: keyof Snapshot; label: string; money?: boolean }[] = [
  { key: "date", label: "Date" },
  { key: "category", label: "Category" },
  { key: "tableName", label: "Table" },
  { key: "startTime", label: "In" },
  { key: "endTime", label: "Out" },
  { key: "partnerName", label: "Investor" },
  { key: "cash", label: "Cash", money: true },
  { key: "bank", label: "Bank", money: true },
  { key: "description", label: "Note" },
];

const TONE = {
  create: "bg-teal/15 text-teal",
  edit: "bg-amber-400/15 text-amber-200",
  delete: "bg-rose-400/15 text-rose-200",
};
const VERB = { create: "Added", edit: "Edited", delete: "Deleted" };

/** "partner:isuru" → "isuru · investor"; anything else is an admin. */
export function who(actor: string) {
  if (actor.startsWith("partner:")) return { name: actor.slice(8), role: "investor" };
  if (actor === "admin-key") return { name: "staff key", role: "admin" };
  if (actor === "opening-setup") return { name: "opening setup", role: "system" };
  return { name: actor, role: "admin" };
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

const show = (v: unknown, money?: boolean) =>
  v === null || v === undefined || v === "" ? "—" : money ? `LKR ${fmt(Number(v))}` : String(v);

function title(s: Snapshot) {
  if (s.tableName) return `${s.tableName}${s.startTime ? ` · ${s.startTime}–${s.endTime}` : ""}`;
  return s.description || s.category || KIND_LABELS[s.kind];
}

export function ChangeLog() {
  const [filter, setFilter] = useState<"all" | "edit" | "delete" | "create">("all");
  const { data, err } = useView<{ log: LogLine[] }>({ view: "log" });
  const rows = (data?.log ?? []).filter((l) => filter === "all" || l.action === filter);

  return (
    <Card
      title="Change log"
      sub="Every entry added, edited or deleted — who did it and when. Only admins can see this."
      action={
        <Seg
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "edit", label: "Edits" },
            { value: "delete", label: "Deletes" },
            { value: "create", label: "Added" },
          ]}
        />
      }
    >
      {!data ? (
        <p className="text-sm text-mist">{err ?? "Loading…"}</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-mist">Nothing here yet.</p>
      ) : (
        <ul className="divide-y divide-white/[0.06]">
          {rows.map((l) => {
            const s = (l.after ?? l.before)!;
            const u = who(l.actor);
            const changed =
              l.action === "edit" && l.before && l.after
                ? FIELDS.filter((f) => String(l.before![f.key] ?? "") !== String(l.after![f.key] ?? ""))
                : [];
            return (
              <li key={l.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="w-36 shrink-0">
                  <p className="text-xs text-white/85">{when(l.at)}</p>
                  <p className="text-[11px] text-mist">
                    {u.name} <span className="text-mist/60">· {u.role}</span>
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/90">
                    <span className={cn("mr-2 rounded-full px-2 py-0.5 text-[10px] font-medium", TONE[l.action])}>
                      {VERB[l.action]}
                    </span>
                    {title(s)}
                    <span className="ml-2 text-[11px] text-mist">
                      {KIND_LABELS[s.kind]} · {shortDate(s.date)}
                    </span>
                  </p>
                  {l.action === "edit" ? (
                    <div className="mt-1.5 space-y-0.5">
                      {changed.map((f) => (
                        <p key={f.key} className="text-[12px]">
                          <span className="inline-block w-20 text-mist">{f.label}</span>
                          <span className="text-rose-200/90 line-through decoration-rose-300/50">
                            {show(l.before![f.key], f.money)}
                          </span>
                          <span className="mx-1.5 text-mist">→</span>
                          <span className="text-teal">{show(l.after![f.key], f.money)}</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-[12px] text-mist">
                      {s.category}
                      {s.cash ? ` · cash LKR ${fmt(s.cash)}` : ""}
                      {s.bank ? ` · bank LKR ${fmt(s.bank)}` : ""}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
