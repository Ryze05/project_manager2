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
