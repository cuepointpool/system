export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function formatLKR(amount: number): string {
  return "LKR " + amount.toLocaleString("en-LK");
}

/** YYYY-MM-DD in local time */
export function toISODate(d: Date): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/** "18:00" -> minutes since midnight */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function label12h(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 && h < 24 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${period}`;
}

/* ---- ecosystem formatting helpers ---- */

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hrs = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const fmt = (v: number, unit: string) => `${v} ${unit}${v === 1 ? "" : "s"}`;
  const body =
    mins < 60
      ? fmt(Math.max(1, mins), "min")
      : hrs < 24
        ? fmt(hrs, "hr")
        : days < 30
          ? fmt(days, "day")
          : fmt(Math.round(days / 30), "month");
  return diff >= 0 ? `${body} ago` : `in ${body}`;
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDayTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function formatTimeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** deterministic teal→navy gradient pair from a string (for avatar fallbacks) */
export function gradientFromString(s: string): [string, string] {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hues = [
    ["#0e3a4a", "#062231"],
    ["#0b4038", "#05231f"],
    ["#123a52", "#08202f"],
    ["#0a3f45", "#04211f"],
    ["#164a4a", "#07242a"],
  ];
  return hues[h % hues.length] as [string, string];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

