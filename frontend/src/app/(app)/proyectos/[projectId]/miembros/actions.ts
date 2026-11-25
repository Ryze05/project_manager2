"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { callApi, formText } from "@/lib/actions";
import type { ActionResult } from "@/lib/types";

export interface InviteState {
  error?: string;
  /** Changes on every successful invitation, so the form can clear itself. */
  sent?: number;
  email?: string;
}

const emailSchema = z.email("Escribe un correo válido");

export async function inviteMemberAction(
  projectId: string,
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const email = formText(formData, "email").trim();

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const result = await callApi(`/projects/${projectId}/invitations`, {
    method: "POST",
    body: { email: parsed.data },
  });
  if (!result.ok) {
    return { error: result.message, email };
  }

  // The pending list of the members page changes.
  revalidatePath(`/proyectos/${projectId}/miembros`);
  return { sent: Date.now() };
}

export async function cancelInvitationAction(
  projectId: string,
  invitationId: string,
): Promise<ActionResult> {
  const result = await callApi(`/projects/${projectId}/invitations/${invitationId}`, {
    method: "DELETE",
  });
  if (!result.ok) {
    return { error: result.message };
  }
  revalidatePath(`/proyectos/${projectId}/miembros`);
  return {};
}

export async function removeMemberAction(
  projectId: string,
  userId: string,
): Promise<ActionResult> {
  const result = await callApi(`/projects/${projectId}/members/${userId}`, { method: "DELETE" });
  if (!result.ok) {
    return { error: result.message };
  }
  revalidatePath("/", "layout");
  return {};
}

/** Promote a member to owner or demote an owner (any owner can, even themselves). */
export async function changeRoleAction(
  projectId: string,
  userId: string,
  role: "OWNER" | "MEMBER",
): Promise<ActionResult> {
  const result = await callApi(`/projects/${projectId}/members/${userId}`, {
    method: "PATCH",
    body: { role },
  });
  if (!result.ok) {
    return { error: result.message };
  }
  // Demoting yourself changes what the layout and every page of the project allow.
  revalidatePath("/", "layout");
  return {};
}

/** The signed-in user leaves the project and goes back to the list. */
export async function leaveProjectAction(projectId: string): Promise<ActionResult> {
  const result = await callApi(`/projects/${projectId}/leave`, { method: "POST" });
  if (!result.ok) {
    return { error: result.message };
  }
  revalidatePath("/", "layout");
  redirect("/proyectos");
}
