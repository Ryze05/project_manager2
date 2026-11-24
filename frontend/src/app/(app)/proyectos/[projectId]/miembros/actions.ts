"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { api } from "@/lib/api";
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
  const raw = formData.get("email");
  const email = typeof raw === "string" ? raw.trim() : "";

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const result = await api(`/projects/${projectId}/members`, {
    method: "POST",
    body: { email: parsed.data },
  });
  if (!result.ok) {
    if (result.status === 401) redirect("/sesion-caducada");
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
  const result = await api(`/projects/${projectId}/members/${userId}`, { method: "DELETE" });
  if (!result.ok) {
    if (result.status === 401) redirect("/sesion-caducada");
    return { error: result.message };
  }
  revalidatePath("/", "layout");
  return {};
}
