"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { callApi, formText } from "@/lib/actions";
import type { ActionResult } from "@/lib/types";

export interface AddMemberState {
  error?: string;
  /** Changes on every successful add, so the form can clear itself. */
  added?: number;
  email?: string;
}

const emailSchema = z.email("Escribe un correo válido");

export async function addMemberAction(
  projectId: string,
  _prev: AddMemberState,
  formData: FormData,
): Promise<AddMemberState> {
  const email = formText(formData, "email").trim();

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const result = await callApi(`/projects/${projectId}/members`, {
    method: "POST",
    body: { email: parsed.data },
  });
  if (!result.ok) {
    return { error: result.message, email };
  }

  // Member counts show in the project list and header; tasks are unassigned on removal.
  revalidatePath("/", "layout");
  return { added: Date.now() };
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
