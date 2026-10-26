"use client";

import { cn } from "@/lib/utils";
import {
  Card,
  KindBadge,
  Money,
  ViaLabel,
  entryAmount,
  entryTitle,
  fmt,
  longDate,
  shortDate,
  useAccounts,
  useView,
  type Balances,
  type CashDay,
  type Entry,
} from "./ui";

type OverviewData = {
  today: string;
  balances: Balances;
  todayTotals: { income: number; incomeCash: number; incomeBank: number; expense: number };
  month: { from: string; income: number; expense: number };
  daily: { date: string; income: number; expense: number }[];
  recent: Entry[];
  lastClose: CashDay | null;
  startDate: string | null;
};

export function Overview({ onGo }: { onGo: (s: "day" | "reports") => void }) {
  const { meta } = useAccounts();
  const { data, err } = useView<OverviewData>({ view: "overview", today: meta.today });
  if (!data) return <p className="text-sm text-mist">{err ?? "Loading…"}</p>;

  const total = data.balances.cash + data.balances.bank;
  const monthNet = data.month.income - data.month.expense;
  const todayNet = data.todayTotals.income - data.todayTotals.expense;
  const investors = meta.partners.filter((p) => p.active);

  return (
    <div className="space-y-6">
      {/* balances */}
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl border border-teal/30 bg-gradient-to-br from-teal/20 via-navy-800 to-navy-950 p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-teal/20 blur-3xl" />
          <p className="text-[11px] uppercase tracking-[0.24em] text-teal">Total funds</p>
          <Money v={total} className="mt-2 block font-display text-4xl font-bold text-white" />
          <p className="mt-2 text-xs text-mist">
            Cash in hand + bank, as of {longDate(data.today)}
            {data.startDate && <> · books start {shortDate(data.startDate)}</>}
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal to-teal-bright"
              style={{ width: total > 0 ? `${(Math.max(0, data.balances.bank) / total) * 100}%` : 0 }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-mist">
            <span>Bank {total > 0 ? Math.round((data.balances.bank / total) * 100) : 0}%</span>
            <span>Cash {total > 0 ? Math.round((data.balances.cash / total) * 100) : 0}%</span>
          </div>
        </div>
        <BalanceCard
          label="Cash in hand"
          v={data.balances.cash}
          icon="💵"
          foot={
            data.lastClose ? (
              <>
                Cash box counted <Money v={data.lastClose.closing ?? 0} className="text-white/80" /> on{" "}
                {shortDate(data.lastClose.date)}
              </>
            ) : (
              "No cash box close yet"
            )
          }
        />
        <BalanceCard label="Bank" v={data.balances.bank} icon="🏦" foot="Deposits, transfers and bank payments" />
      </div>

      {/* today + month */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card
          title="Today"
          sub={longDate(data.today)}
          action={
            <button onClick={() => onGo("day")} className="btn-ghost px-3 py-1.5 text-[11px]">
              Open day book →
            </button>
          }
        >
          <div className="grid grid-cols-3 gap-3">
            <Figure k="Income" v={data.todayTotals.income} tone="teal" />
            <Figure k="Expenses" v={data.todayTotals.expense} tone="rose" />
            <Figure k="Net" v={todayNet} />
          </div>
          <p className="mt-3 text-[11px] text-mist">
            Income by cash <span className="text-white/80">{fmt(data.todayTotals.incomeCash)}</span> · by bank{" "}
            <span className="text-white/80">{fmt(data.todayTotals.incomeBank)}</span>
          </p>
        </Card>
        <Card
          title="This month"
          sub={`${shortDate(data.month.from)} – ${shortDate(data.today)}`}
          action={
            <button onClick={() => onGo("reports")} className="btn-ghost px-3 py-1.5 text-[11px]">
              Reports →
            </button>
          }
        >
          <div className="grid grid-cols-3 gap-3">
            <Figure k="Income" v={data.month.income} tone="teal" />
            <Figure k="Expenses" v={data.month.expense} tone="rose" />
            <Figure k={monthNet >= 0 ? "Profit" : "Loss"} v={monthNet} />
          </div>
          <p className="mt-3 text-[11px] text-mist">Operating income less expenses — before tax.</p>
        </Card>
      </div>

      {/* 14-day chart */}
      <Card title="Last 14 days" sub="Daily income against expenses">
        <Bars daily={data.daily} />
      </Card>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.3fr]">
        <Card title="Investors" sub="Ownership share and their part of today's funds">
          <div className="space-y-3">
            {investors.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <Ring pct={p.sharePct} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{p.name}</p>
                  <p className="text-[11px] text-mist">
                    {p.canEditAccounts ? "Can edit accounts" : "View only"}
                  </p>
                </div>
                <Money v={Math.round((total * p.sharePct) / 100)} className="text-sm text-white/90" />
              </div>
            ))}
            {investors.length === 0 && <p className="text-xs text-mist">No investors yet.</p>}
          </div>
        </Card>
        <Card title="Latest entries">
          <ul className="divide-y divide-white/[0.06]">
            {data.recent.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5">
                <span className="w-14 shrink-0 text-[11px] text-mist">{shortDate(e.date)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white/90">{entryTitle(e)}</p>
                  <p className="text-[11px]">
                    <KindBadge kind={e.kind} /> <ViaLabel e={e} />
                  </p>
                </div>
                <Money
                  v={e.kind === "expense" || e.kind === "drawing" ? -entryAmount(e) : entryAmount(e)}
                  className={cn("text-sm", e.kind === "income" && "text-teal")}
                />
              </li>
            ))}
            {data.recent.length === 0 && <li className="py-3 text-xs text-mist">Nothing recorded yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function BalanceCard({
  label,
  v,
  icon,
  foot,
}: {
  label: string;
  v: number;
  icon: string;
  foot: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.2em] text-mist">{label}</p>
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
      </div>
      <Money v={v} className="mt-2 block font-display text-3xl font-bold text-white" />
      <p className="mt-2 text-[11px] text-mist">{foot}</p>
    </div>
  );
}

function Figure({ k, v, tone }: { k: string; v: number; tone?: "teal" | "rose" }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
      <p className="text-[10px] uppercase tracking-wide text-mist">{k}</p>
      <Money
        v={v}
        tag={false}
        className={cn(
          "mt-1 block font-display text-xl font-bold",
          tone === "teal" ? "text-teal" : tone === "rose" ? "text-rose-200" : "text-white",
        )}
      />
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  return (
    <div
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(#00c2a8 ${pct * 3.6}deg, rgba(255,255,255,0.08) 0)` }}
    >
      <div className="grid h-8 w-8 place-items-center rounded-full bg-navy-900 text-[11px] font-bold text-white">
        {pct}%
      </div>
    </div>
  );
}

function Bars({ daily }: { daily: OverviewData["daily"] }) {
  const max = Math.max(1, ...daily.flatMap((d) => [d.income, d.expense]));
  return (
    <div>
      <div className="flex h-44 items-end gap-1.5 sm:gap-2">
        {daily.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 items-end justify-center gap-[2px]">
            <div
              className="w-1/2 max-w-[14px] rounded-t bg-teal/80 transition group-hover:bg-teal"
              style={{ height: `${(d.income / max) * 100}%`, minHeight: d.income ? 2 : 0 }}
            />
            <div
              className="w-1/2 max-w-[14px] rounded-t bg-rose-400/60 transition group-hover:bg-rose-400"
              style={{ height: `${(d.expense / max) * 100}%`, minHeight: d.expense ? 2 : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-lg border border-white/10 bg-navy-950 px-2.5 py-1.5 text-[10px] text-white shadow-xl group-hover:block">
              <p className="font-medium">{shortDate(d.date)}</p>
              <p className="text-teal">In {fmt(d.income)}</p>
              <p className="text-rose-200">Out {fmt(d.expense)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2">
        {daily.map((d, i) => (
          <span key={d.date} className="flex-1 text-center text-[9px] text-mist">
            {i % 2 === daily.length % 2 ? "" : shortDate(d.date).split(" ")[0]}
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-[11px] text-mist">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-teal" /> Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-rose-400/70" /> Expenses
        </span>
      </div>
    </div>
  );
}
