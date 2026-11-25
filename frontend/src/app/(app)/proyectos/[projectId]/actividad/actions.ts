"use server";

import { callApi } from "@/lib/actions";
import { toFeedItem } from "@/lib/activity";
import type { ActivityPage, FeedItem } from "@/lib/types";

export type MoreActivity = { items: FeedItem[]; nextCursor: string | null } | { error: string };

/** The next (older) page of the history, for the "Ver más" button. */
export async function loadActivityAction(
  projectId: string,
  taskId: string,
  cursor: string,
  limit: number,
  actorId: string = "",
): Promise<MoreActivity> {
  // Called from a client component: the API validates the ids, here only the numbers.
  const params = new URLSearchParams({
    cursor,
    limit: String(Math.min(Math.max(Math.trunc(limit) || 50, 1), 100)),
  });
  if (taskId) params.set("taskId", taskId);
  if (actorId) params.set("actorId", actorId);
  const result = await callApi<ActivityPage>(`/projects/${projectId}/activity?${params}`);
  if (!result.ok) return { error: result.message };
  return {
    items: result.data.items.map((event) => toFeedItem(event, projectId)),
    nextCursor: result.data.nextCursor,
  };
}
