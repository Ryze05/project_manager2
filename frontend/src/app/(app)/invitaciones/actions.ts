"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { callApi } from "@/lib/actions";
import type { ActionResult } from "@/lib/types";

/** Joins the project and goes to it. The sidebar (projects, counter) lives in the layout. */
export async function acceptInvitationAction(invitationId: string): Promise<ActionResult> {
  const result = await callApi<{ projectId: string }>(`/me/invitations/${invitationId}/accept`, {
    method: "POST",
  });
  if (!result.ok) {
    return { error: result.message };
  }
  revalidatePath("/", "layout");
  redirect(`/proyectos/${result.data.projectId}`);
}

export async function declineInvitationAction(invitationId: string): Promise<ActionResult> {
  const result = await callApi(`/me/invitations/${invitationId}/decline`, { method: "POST" });
  if (!result.ok) {
    return { error: result.message };
  }
  revalidatePath("/", "layout");
  return {};
}
