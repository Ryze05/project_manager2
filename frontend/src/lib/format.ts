const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "hace 2 horas", "ayer"... for an ISO date string. */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "ahora mismo";
}

/** "10 dic" (plus the year when it is not the current one). The API stores the date at UTC midnight, so format in UTC. */
export function formatDueDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const sameYear = date.getUTCFullYear() === now.getFullYear();
  return date.toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  });
}

/** True when the due day is before today (compared as YYYY-MM-DD, no time zones involved). */
export function isOverdue(iso: string, now = new Date()): boolean {
  const today = now.toLocaleDateString("sv-SE"); // YYYY-MM-DD in local time
  return iso.slice(0, 10) < today;
}

export type DueBucket = "overdue" | "today" | "week" | "later" | "none" | "done";

/** Local date as YYYY-MM-DD, `days` from `from`. */
function ymd(from: Date, days = 0): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("sv-SE");
}

/**
 * Where a task sits in time: overdue, today, the next 7 days, later, or no date.
 * Done tasks have their own bucket (an old due date no longer makes them overdue).
 */
export function dueBucket(iso: string | null, done: boolean, now = new Date()): DueBucket {
  if (done) return "done";
  if (iso === null) return "none";
  const day = iso.slice(0, 10);
  if (day < ymd(now)) return "overdue";
  if (day === ymd(now)) return "today";
  if (day <= ymd(now, 7)) return "week";
  return "later";
}
