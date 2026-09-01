import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookingWidget } from "@/components/BookingWidget";
import { HOURS_DISPLAY, SITE } from "@/lib/config";
import { getViewer } from "@/lib/ecosystem/identity";
import { listTables } from "@/lib/tables";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book a table",
  description:
    "Reserve a pool or VIP table at Cue Point, Pitipana, Homagama. Live availability and instant confirmation.",
};

const ASSURANCES = [
  { t: "Live availability", d: "Every slot you see is really open right now." },
  { t: "No booking fee", d: "Pay only for table time, at the counter." },
  { t: "Free cancellation", d: "Cancel up to 2 hours before your slot." },
  {
    t: "3-min changeover",
    d: "If another group is booked after you, hand the table back 3 minutes early.",
  },
];

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  // staff & admin manage tables from the console, not the public booking flow
  const viewer = await getViewer();
  if (viewer && viewer.role !== "player") redirect("/admin");

  const sp = await searchParams;
  const table = typeof sp.table === "string" ? sp.table : null;
  const tables = (await listTables()).map((t) => ({
    id: t.id,
    label: t.label,
    area: t.area,
    note: t.note,
    seats: t.seats,
  }));

  return (
    <div className="relative min-h-screen overflow-hidden pb-24 pt-28 sm:pb-28 sm:pt-32">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] max-w-[140vw] -translate-x-1/2 rounded-full bg-teal/12 blur-[130px]" />
      <h1
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-16 hidden text-center font-display text-[16vw] font-bold leading-none text-stroke sm:block"
      >
        BOOK
      </h1>

      <div className="relative mx-auto max-w-5xl px-5 md:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-mist transition-colors hover:text-white"
        >
          <span aria-hidden>←</span> Back to Cue Point
        </Link>

        <div className="mt-6 max-w-xl">
          <span className="text-xs uppercase tracking-[0.35em] text-teal">Reserve your table</span>
          <h2 className="mt-4 font-display text-4xl font-bold leading-[1.05] text-white md:text-5xl">
            Lock in your <span className="text-teal-gradient">frame</span>
          </h2>
          <p className="mt-4 text-mist">
            See every table and what&apos;s already booked, tap an open slot, and you&apos;ll
            get a reference to show at the counter in Pitipana, Homagama.
          </p>
        </div>

        <div className="mt-10">
          <BookingWidget initialTable={table} tables={tables} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <h3 className="text-xs uppercase tracking-[0.25em] text-teal">Good to know</h3>
            <ul className="mt-4 space-y-4">
              {ASSURANCES.map((a) => (
                <li key={a.t}>
                  <p className="text-sm font-medium text-white">{a.t}</p>
                  <p className="mt-0.5 text-xs text-mist">{a.d}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <h3 className="text-xs uppercase tracking-[0.25em] text-teal">Opening hours</h3>
            <ul className="mt-4 space-y-2.5">
              {HOURS_DISPLAY.map((h) => (
                <li key={h.day} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-mist">{h.day}</span>
                  <span className="text-right text-white">{h.time}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm">
            <h3 className="text-xs uppercase tracking-[0.25em] text-teal">Prefer to call?</h3>
            <a
              href={SITE.phoneHref}
              className="mt-3 block font-display text-lg text-white transition-colors hover:text-teal"
            >
              {SITE.phone}
            </a>
            <a
              href={`mailto:${SITE.email}`}
              className="mt-1 block text-xs text-mist transition-colors hover:text-white"
            >
              {SITE.email}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
