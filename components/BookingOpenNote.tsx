import { SITE } from "@/lib/config";

type T = { label: string; bookable: boolean };

/** One line under a booking section's intro: which tables take online
 *  bookings, and how to reserve the rest. Renders nothing until the
 *  table list is known or if every table is bookable. */
export function BookingOpenNote({
  tables,
  className = "",
}: {
  tables: T[];
  className?: string;
}) {
  if (!tables.length) return null;
  const open = tables.filter((t) => t.bookable);
  const locked = tables.filter((t) => !t.bookable);
  if (!locked.length) return null;

  return (
    <p
      className={`mx-auto mt-3 max-w-lg text-[12px] text-mist ${className}`}
    >
      Online booking is open for{" "}
      <span className="font-semibold text-teal">
        {open.map((t) => t.label).join(", ") || "—"}
      </span>
      . {locked.map((t) => t.label).join(" & ")}{" "}
      {locked.length > 1 ? "are" : "is"} available to view — call{" "}
      <a href={SITE.phoneHref} className="font-semibold text-white underline">
        {SITE.phone}
      </a>{" "}
      to reserve {locked.length > 1 ? "them" : "it"}.
    </p>
  );
}
