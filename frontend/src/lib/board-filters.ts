/** Board filters live in the URL: `?label=<id>&label=<id>&assignee=<id|none>&priority=HIGH&due=overdue`. */

export const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export const DUE_FILTERS = ["overdue", "week", "none"] as const;

export interface BoardFilters {
  label: string[];
  /** A user id, or "none" for tasks without a responsible. */
  assignee: string;
  priority: string[];
  due: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Raw = Record<string, string | string[] | undefined>;

const list = (value: string | string[] | undefined) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

/**
 * Reads the filters from the page's search params. Anything that is not a
 * valid value is dropped (a hand-edited URL must not break the board with a 400).
 */
export function parseFilters(raw: Raw): BoardFilters {
  const assignee = list(raw.assignee)[0] ?? "";
  const due = list(raw.due)[0] ?? "";
  return {
    label: [...new Set(list(raw.label).filter((id) => UUID.test(id)))],
    assignee: assignee === "none" || UUID.test(assignee) ? assignee : "",
    priority: [...new Set(list(raw.priority).filter((p) => (PRIORITIES as readonly string[]).includes(p)))],
    due: (DUE_FILTERS as readonly string[]).includes(due) ? due : "",
  };
}

/** "" when nothing is filtered, else "?label=...". */
export function toQuery(filters: BoardFilters): string {
  const params = new URLSearchParams();
  filters.label.forEach((id) => params.append("label", id));
  if (filters.assignee) params.set("assignee", filters.assignee);
  filters.priority.forEach((p) => params.append("priority", p));
  if (filters.due) params.set("due", filters.due);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function hasFilters(filters: BoardFilters): boolean {
  return toQuery(filters) !== "";
}
